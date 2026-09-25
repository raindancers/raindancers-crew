# Requirements — `@raindancers/raindancers-crew` library changes for the 55minutes brain

## Purpose

The 55minutes cloud orchestrator (a **consumer** of this library) needs the brain box —
`RemoteCrewInstance` — to run in a **private, dual-stack, IPv6-preferred subnet with no public
IP**, be woken by the **native KiroCrew webhook** (`POST /api/hooks/agent`, Bearer token) reachable
**only from the ingest Lambda's security group**, and run as an **always-on conductor-driven crew**
(Autopilot, no idle-session-close).

The current construct is **IPv4- and public-subnet-shaped, SSM-reached, with no inbound app port**.
This spec is a **change order against the existing construct**, written against its real interface
(PRs #1–#4 on `raindancers/raindancers-crew`), not a greenfield design. Everything here is
**additive and backward-compatible**: current consumers (public-subnet default, SSM-only, no
webhook) keep working with unchanged behaviour.

## Baseline — what the construct is today (do not re-derive)

`RemoteCrewInstanceProps` (current, verbatim): `vpc` (req), `permissionsBoundaryArn` (req),
`vpcSubnets` (default one **public** subnet), `instanceType`, `architecture` (default `ARM64`),
`volumeSizeGb` (60), `associatePublicIp` (**default `true`**), `stackTag` (`kirocrew`),
`dashboardPort` (5476, **loopback-only via SSM port-forward**), `allowSshCidr` (opt, opens tcp/22
from an IPv4 CIDR ≤/16), `source` (`CrewSource`), `bootstrapTimeoutMinutes` (25), `backupBucket`,
`backupSchedule`, `backupPrefix`.

Current facts that constrain the design:
- **One security group**, `allowAllOutbound: true` (⇒ IPv4 `0.0.0.0/0` egress only), **no inbound
  by default**. The only ingress prop is `allowSshCidr` → `Peer.ipv4(cidr)` + `Port.tcp(22)`.
  **No source-SG peer, no app port.**
- **No IPv6 anywhere** — no `assignIpv6AddressOnCreation`, no IPv6 egress rule, no EIGW awareness.
- **`bootstrap.sh`** runs `kirocrew setup --agent-only` then `kirocrew gateway`, systemd unit sets
  only `KIROCREW_PORT`/`HOME`/`PATH`, health check hits `http://127.0.0.1:$DASHBOARD_PORT/`.
  **No `POST /api/hooks/agent`, no Bearer token, no Autopilot, no idle-close, no roster.**

## Requirements

### RC1 — Dual-stack, IPv6-preferred ENI (additive)

- **RC1.1** A new optional prop enables IPv6 on the instance ENI: `enableIpv6?: boolean` (default
  `false` — current consumers unaffected). When `true`, the ENI is assigned an IPv6 address
  (`assignIpv6AddressOnCreation` / launch-template ENI IPv6 count = 1).
- **RC1.2** When `enableIpv6` is `true`, the construct's security group MUST add an **IPv6 egress
  rule** (`ec2.Peer.anyIpv6()`, all traffic) alongside the existing IPv4 all-outbound, so IPv6
  egress is actually permitted (CDK's `allowAllOutbound` emits IPv4 only).
- **RC1.3** `enableIpv6` requires the selected subnet(s) to have IPv6 CIDRs; the construct does
  **not** provision subnet IPv6 CIDRs, an Egress-Only IGW, or any route — those are the consumer's
  VPC (`IVpc`) responsibility. A synth-time note/validation should make this contract explicit.
- **RC1.4** `enableIpv6: true` with `associatePublicIp: false` (the 55minutes posture) MUST be a
  valid, tested combination: a private dual-stack instance with IPv6 egress and no public IPv4.

### RC2 — Webhook ingress from a source security group (additive)

- **RC2.1** A new optional prop exposes the gateway's webhook port to a **specific source security
  group** only: `webhookIngress?: { source: ec2.ISecurityGroup; port?: number }`. When set, the
  construct's SG adds `addIngressRule(Peer.securityGroupId(source SG id), Port.tcp(port))`.
- **RC2.2** `port` defaults to the gateway's webhook listener port (see RC3.1). No wider peer is
  ever allowed for the webhook — **no CIDR form** of this prop; it is source-SG-only by construction
  (the whole point is that the box is never internet-reachable).
- **RC2.3** `webhookIngress` is independent of `allowSshCidr` — both, either, or neither may be set.
  When neither any ingress prop is set, the SG remains no-inbound (unchanged default).
- **RC2.4** The construct MUST expose its security group (already does, `this.securityGroup`) so the
  consumer can also reference it from the ingest Lambda side if needed; and MUST accept the source
  SG as an `ISecurityGroup` (imported), not require creating it.

### RC3 — Native webhook wake + Bearer token in bootstrap (additive)

- **RC3.1** A new optional prop configures the gateway to serve the native webhook on a routable
  bind (not loopback-only) when webhook ingress is in use: the gateway listens for
  `POST /api/hooks/agent`. The listener port is what RC2.2 defaults to.
- **RC3.2** The Bearer token that authenticates the webhook is delivered as a **Secrets Manager
  secret ARN** prop (e.g. `webhookTokenSecretArn?: string`). `bootstrap.sh` fetches it at boot and
  sets it in the gateway's environment. **No token in userData, env literals, or code.** The
  instance role is granted `secretsmanager:GetSecretValue` on **that one secret ARN only**.
- **RC3.3** The dashboard port (5476) remains **loopback-only via SSM** as today — RC3.1 opens only
  the webhook route on its own port, not the dashboard.
- **RC3.4** When no webhook props are set, `bootstrap.sh` behaviour is byte-for-byte unchanged
  (loopback dashboard, SSM-only, no token) — backward compatibility is a hard requirement.

### RC4 — Always-on crew runtime: Autopilot, no idle-close, conductor roster (additive)

- **RC4.1** A new optional prop enables **Autopilot mode** on the hosted crew, threaded into the
  bootstrap `kirocrew` configuration/env.
- **RC4.2** A new optional prop disables **idle-session-close** so the 24/7 brain is not torn down
  between events.
- **RC4.3** The construct supports provisioning a **crew-member / conductor roster** at boot (the
  installed agent configs, including the conductor). Shape TBD in design: a prop carrying roster
  config, or a documented `source`-delivered config the bootstrap applies. This is the R6.8 seam
  from the 55minutes spec.
- **RC4.4** All of RC4 are optional and default to the current gateway defaults; omitting them
  reproduces today's `kirocrew setup --agent-only` + `kirocrew gateway` behaviour exactly.

### RC5 — Out of scope for this library (stated so the consumer owns them)

- **RC5.1** **Egress-Only Internet Gateway** (IPv6 egress route) — a VPC/route-table resource. The
  construct consumes an `IVpc` and provisions no routing. The 55minutes app / its VPC construct owns
  it.
- **RC5.2** **fck-nat** (single-AZ IPv4 egress) — a consumer VPC instance + route concern. Not a
  `RemoteCrewInstance` prop.
- **RC5.3** **The ingest Lambda and its security group** — live in the consumer app (55minutes
  `CrewIngress`). `RemoteCrewInstance` only *accepts* that SG as `webhookIngress.source` (RC2.1).

## Non-functional requirements

- **Backward compatibility (hard):** every new prop is optional with a default that reproduces
  current behaviour. `test/` must assert the no-prop synth is unchanged.
- **Security:** webhook ingress is source-SG-only (never a CIDR); the Bearer token is a Secrets
  Manager ARN with a single-secret grant; the dashboard stays loopback/SSM-only; the permissions
  boundary stays required.
- **jsii-clean:** new prop types must be jsii-compatible (interfaces/enums, no TS-only constructs) —
  the library publishes via jsii (`~5.9.0`, cdk `2.260.0`).
- **Testability:** each requirement maps to a CDK assertion test (SG rules, ENI IPv6, secret grant)
  and/or a bootstrap-rendering test.

## Definition of done

- `RemoteCrewInstance` accepts and correctly wires: `enableIpv6`, `webhookIngress`,
  `webhookTokenSecretArn` (+ webhook listener config), and the Autopilot / no-idle-close / roster
  props — all additive, all optional.
- The **private dual-stack + no-public-IP + source-SG webhook + native-webhook-wake** posture the
  55minutes brain needs is achievable purely from props, with EIGW/fck-nat/ingest-Lambda left to the
  consumer.
- No-prop synth is proven byte-unchanged; every new capability has a test.
- README usage gains a "private dual-stack brain" example.
