# Design — `@raindancers/raindancers-crew` changes for the 55minutes brain

All changes land on **`RemoteCrewInstance`** and its `bootstrap.sh`. Every one is **additive**;
the no-prop path is unchanged. Files touched:
`src/remote-crew-instance-props.ts`, `src/remote-crew-instance.ts`, `src/assets/bootstrap.sh`,
and tests under `test/`.

## Prop additions (jsii-clean)

Extend `RemoteCrewInstanceProps` with these optional fields:

```ts
/** Assign an IPv6 address to the instance ENI and permit IPv6 egress.
 *  Requires the selected subnet(s) to have IPv6 CIDRs — this construct does NOT
 *  provision subnet CIDRs, an Egress-Only IGW, or routes (consumer VPC concern).
 *  @default false */
readonly enableIpv6?: boolean;

/** Expose the gateway's native-webhook port to ONE source security group only.
 *  There is deliberately no CIDR form: the box is never internet-reachable. */
readonly webhookIngress?: WebhookIngress;

/** Secrets Manager ARN of the Bearer token that authenticates POST /api/hooks/agent.
 *  Fetched at boot into the gateway env; instance role gets GetSecretValue on this ARN only.
 *  Required when webhookIngress is set. @default - webhook disabled (loopback/SSM only) */
readonly webhookTokenSecretArn?: string;

/** 24/7 brain runtime settings, threaded into the bootstrap kirocrew config. */
readonly crewRuntime?: CrewRuntime;
```

New jsii interfaces:

```ts
export interface WebhookIngress {
  /** Imported SG allowed to reach the webhook port (e.g. the ingest Lambda's SG). */
  readonly source: ec2.ISecurityGroup;
  /** Webhook listener TCP port. @default 5477 (dashboard stays on dashboardPort/5476, loopback) */
  readonly port?: number;
}

export interface CrewRuntime {
  /** Enable Autopilot mode. @default false (gateway default) */
  readonly autopilot?: boolean;
  /** Keep the brain session alive between events (disable idle-session-close). @default false */
  readonly disableIdleClose?: boolean;
  /** Roster config the bootstrap applies (installed agent configs incl. the conductor).
   *  Delivered via `source` or an inline manifest — see "Roster provisioning" below. */
  readonly roster?: CrewRosterConfig;
}
```

**Why a separate webhook port (default 5477), not 5476:** the dashboard port stays loopback-only,
reached via SSM port-forward, exactly as today (RC3.3). Opening ingress on 5476 would expose the
dashboard to the source SG. The webhook route binds on its own port so only `POST /api/hooks/agent`
is reachable from the ingest Lambda.

## Security-group changes (`remote-crew-instance.ts`)

The construct already creates one SG (`allowAllOutbound: true`, no inbound). Add, conditionally:

1. **IPv6 egress** (when `enableIpv6`):
   ```ts
   this.securityGroup.addEgressRule(ec2.Peer.anyIpv6(), ec2.Port.allTraffic(), 'IPv6 egress');
   ```
   (CDK's `allowAllOutbound` renders IPv4 `0.0.0.0/0` only, so the v6 rule is required — RC1.2.)

2. **Webhook ingress from the source SG** (when `webhookIngress`):
   ```ts
   const port = props.webhookIngress.port ?? 5477;
   this.securityGroup.addIngressRule(
     ec2.Peer.securityGroupId(props.webhookIngress.source.securityGroupId),
     ec2.Port.tcp(port),
     'Native webhook from ingest Lambda SG only');
   ```
   Never a CIDR peer (RC2.2). The existing `allowSshCidr` path is untouched and independent (RC2.3).

## ENI / IPv6 (when `enableIpv6`)

`RemoteCrewInstance` launches via a launch template / instance. Set IPv6 on the primary ENI:
- Launch-template network interface `ipv6AddressCount: 1` (or `assignIpv6AddressOnCreation` on the
  ENI), gated on `enableIpv6`.
- Leave `associatePublicIp` to the existing prop; the 55minutes posture passes
  `associatePublicIp: false` + `enableIpv6: true` → private, dual-stack, IPv6-egress, no public IPv4
  (RC1.4). Add a synth-time note when `enableIpv6` is set but the resolved subnets expose no IPv6
  CIDR (best-effort; the VPC owns the CIDR — RC1.3).

## Secrets grant (when `webhookTokenSecretArn`)

```ts
const secret = secretsmanager.Secret.fromSecretCompleteArn(this, 'WebhookToken', arn);
secret.grantRead(this.role);   // GetSecretValue on this one secret ARN only (RC3.2)
```
Fail synth if `webhookIngress` is set without `webhookTokenSecretArn` (a reachable webhook with no
auth is a defect, not a default).

## `bootstrap.sh` changes — all guarded, default path unchanged (RC3.4 / RC4.4)

Today: `kirocrew setup --agent-only` → `kirocrew gateway`; systemd unit sets `KIROCREW_PORT`,
`HOME`, `PATH`; health check `curl http://127.0.0.1:$DASHBOARD_PORT/`.

Add, only when the corresponding CFN parameter/env is non-empty (passed from the construct as
userData substitutions):

- **Webhook token:** if `WEBHOOK_TOKEN_SECRET_ARN` set → `aws secretsmanager get-secret-value` at
  boot, export the token into the gateway env (e.g. `KIROCREW_HOOK_TOKEN`), and configure the
  gateway to serve `POST /api/hooks/agent` on `WEBHOOK_PORT` (default 5477) bound to the instance's
  routable address (not loopback). Dashboard stays on `KIROCREW_PORT` loopback.
- **Autopilot:** if enabled → the `kirocrew` config/env flag that turns Autopilot on.
- **No idle-close:** if enabled → the session-idle-close-disable setting.
- **Roster:** see below.

The token is fetched, never baked. Keep the WaitCondition/health-check gate; extend it to also
confirm the webhook route answers when the webhook is configured.

### Roster provisioning (RC4.3)

Two candidate mechanisms — design picks one in tasks:
- **(a) `source`-delivered manifest:** the roster ships as part of the KiroCrew source tarball /
  repo the box already installs; bootstrap runs `kirocrew agent`-equivalent apply. Zero new transport.
- **(b) Inline `CrewRosterConfig`:** the construct writes a small manifest to userData/SSM param and
  bootstrap applies it. More prop surface, but self-contained.
  Lean **(a)** unless the consumer needs per-deploy roster variation; keep the prop as the seam.

## Backward-compatibility proof

- No-prop synth ⇒ identical template (assertion test snapshots the SG rules = none-inbound +
  IPv4-only egress, no IPv6 ENI, no secret grant, and the rendered `bootstrap.sh` = current bytes).
- Each new capability is behind a truthy prop; the `if`-guards in `bootstrap.sh` mean an unset
  parameter renders the current script.

## What stays in the consumer (55minutes), restated

EIGW (IPv6 egress route), fck-nat (IPv4 egress), the ingest Lambda + its SG, and the SCP carve-out
are **not** in this library. `RemoteCrewInstance` accepts the ingest Lambda's SG as
`webhookIngress.source` and nothing more.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Webhook port | separate `5477`, not the dashboard `5476` | dashboard stays loopback/SSM-only; only the hook route is exposed |
| Webhook peer | source-SG only, no CIDR form | the box is never internet-reachable by contract |
| Bearer token | Secrets Manager ARN prop, single-secret grant, fetched at boot | no secret in userData/code |
| IPv6 routing | out of scope (consumer VPC) | construct takes `IVpc`, provisions no routes/EIGW |
| Roster transport | prefer `source`-delivered manifest, keep prop as seam | least new surface; self-contained fallback exists |
| Compatibility | every prop optional, default = today | no migration for existing consumers |
