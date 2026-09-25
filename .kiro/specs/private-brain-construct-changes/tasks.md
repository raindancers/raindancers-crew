# Tasks — `@raindancers/raindancers-crew` changes for the 55minutes brain

Ordered, checkable. Each group is one reviewable PR against `raindancers/raindancers-crew`,
additive and backward-compatible. All work lands on `RemoteCrewInstance` + `bootstrap.sh` + tests.
`[ ]` not started. Do groups in order; RC2/RC3 depend on RC-props being in place.

**Repo facts:** jsii `AwsCdkConstructLibrary`, cdk `2.260.0`, jsii `~5.9.0`, default branch `main`,
`src/assets/**` force-bundled. Build/test: `npx projen build` (synth + compile + eslint + jest).

---

## RC0. Baseline lock (no code) — PR: n/a (do first, in the spec)

- [ ] RC0.1 Snapshot the current no-prop synth of `RemoteCrewInstance` into a golden test fixture
      **before** any change, so every later group can assert "no-prop template unchanged". (NFR)
- [ ] RC0.2 Snapshot the current rendered `bootstrap.sh` bytes as a fixture for the same reason.

---

## RC1. Dual-stack IPv6 ENI — PR: `feat/rci-ipv6`

- [ ] RC1.1 Add `enableIpv6?: boolean` (default `false`) to `RemoteCrewInstanceProps`. (RC1.1)
- [ ] RC1.2 In `remote-crew-instance.ts`, when `enableIpv6`: set the primary ENI's
      `ipv6AddressCount: 1` (launch template network interface / `assignIpv6AddressOnCreation`). (RC1.1)
- [ ] RC1.3 Add the IPv6 egress SG rule (`Peer.anyIpv6()`, `Port.allTraffic()`) when `enableIpv6`,
      since `allowAllOutbound` emits IPv4-only. (RC1.2)
- [ ] RC1.4 Synth-time best-effort note when `enableIpv6` is set but the resolved subnets expose no
      IPv6 CIDR (the VPC owns the CIDR/EIGW — not this construct). (RC1.3)
- [ ] RC1.5 Tests: assertion test that `enableIpv6: true` adds an IPv6 address to the ENI and an
      IPv6 egress rule; that `enableIpv6: true` + `associatePublicIp: false` synths a private
      dual-stack instance with no public IPv4; and that the **no-prop golden (RC0.1) is unchanged**. (RC1.4, NFR)

**Done when:** a consumer can request a private, dual-stack, IPv6-egress, no-public-IP instance
purely via `enableIpv6: true` + `associatePublicIp: false` + private `vpcSubnets`, proven by synth.

---

## RC2. Source-SG webhook ingress — PR: `feat/rci-webhook-ingress`

- [ ] RC2.1 Add the `WebhookIngress` jsii interface (`source: ec2.ISecurityGroup`, `port?: number`
      default 5477) and the `webhookIngress?: WebhookIngress` prop. (RC2.1, RC2.2)
- [ ] RC2.2 When set, add `securityGroup.addIngressRule(Peer.securityGroupId(source.securityGroupId),
      Port.tcp(port), ...)`. **No CIDR form.** Leave `allowSshCidr` path untouched. (RC2.1, RC2.3)
- [ ] RC2.3 Confirm/keep `this.securityGroup` exported so the consumer can reference it. (RC2.4)
- [ ] RC2.4 Tests: assertion test that `webhookIngress` adds exactly one ingress rule, peer =
      source SG id, port = 5477 (or override), and **no** `0.0.0.0/0`/`::/0` ingress ever appears;
      that omitting it leaves the SG no-inbound; golden unchanged. (RC2.2, NFR)

**Done when:** the webhook port is reachable only from the named source SG, and the default stays
no-inbound.

---

## RC3. Native webhook wake + Bearer token — PR: `feat/rci-webhook-runtime`

- [ ] RC3.1 Add `webhookTokenSecretArn?: string`. Synth-fail if `webhookIngress` is set without it
      (reachable webhook must have auth). (RC3.2, design guard)
- [ ] RC3.2 Grant `secret.grantRead(this.role)` via `Secret.fromSecretCompleteArn` — GetSecretValue
      on that one ARN only. (RC3.2)
- [ ] RC3.3 `bootstrap.sh` (guarded on a non-empty `WEBHOOK_TOKEN_SECRET_ARN` substitution): fetch
      the token with `aws secretsmanager get-secret-value`, export into the gateway env
      (`KIROCREW_HOOK_TOKEN`), configure the gateway to serve `POST /api/hooks/agent` on
      `WEBHOOK_PORT` (default 5477) on the routable address. Dashboard stays loopback on
      `KIROCREW_PORT`. (RC3.1, RC3.3)
- [ ] RC3.4 Extend the WaitCondition/health check to also confirm the webhook route answers when
      configured. (RC3.1)
- [ ] RC3.5 Tests: assertion test for the single-secret read grant; a bootstrap-render test that
      with no webhook props the script equals the **RC0.2 golden bytes**, and with them present it
      gains exactly the guarded token-fetch + webhook-serve lines (no token literal anywhere). (RC3.4, NFR)

**Done when:** the box serves the native webhook on its own port, authenticated by a Secrets-Manager
Bearer token fetched at boot, with the dashboard still loopback/SSM-only and the no-prop script
byte-identical.

---

## RC4. Always-on crew runtime (Autopilot / no-idle-close / roster) — PR: `feat/rci-crew-runtime`

- [ ] RC4.1 Add the `CrewRuntime` interface (`autopilot?`, `disableIdleClose?`, `roster?`) and the
      `crewRuntime?: CrewRuntime` prop. (RC4.1, RC4.2, RC4.3)
- [ ] RC4.2 `bootstrap.sh` (guarded): when `autopilot` → set the Autopilot config/env flag; when
      `disableIdleClose` → set the idle-close-disable setting. Default path unchanged. (RC4.1, RC4.2)
- [ ] RC4.3 Roster: implement the chosen mechanism (design leans **`source`-delivered manifest** —
      bootstrap applies the roster the installed source carries via a `kirocrew agent`-equivalent
      step). Keep `CrewRosterConfig` as the seam even if the first cut is source-delivered. (RC4.3)
- [ ] RC4.4 Tests: bootstrap-render tests that each flag appears only when its prop is set, and the
      no-prop render matches the RC0.2 golden; a doc/assertion that the roster mechanism applies the
      conductor + members. (RC4.4, NFR)

**Done when:** the hosted crew comes up in Autopilot, never idle-closes, and has its conductor +
member roster — all opt-in, with the default gateway behaviour intact when omitted.

---

## RC5. Docs — PR: `docs/rci-private-brain-usage`

- [ ] RC5.1 README: add a "Private dual-stack brain (55minutes posture)" usage example composing
      `enableIpv6`, `associatePublicIp: false`, private `vpcSubnets`, `webhookIngress` (with an
      imported ingest-Lambda SG), `webhookTokenSecretArn`, and `crewRuntime`.
- [ ] RC5.2 README: explicitly state what stays in the consumer VPC/app (EIGW, fck-nat, ingest
      Lambda + SG, SCP), so a reader does not expect the construct to provision routing. (RC5.1–5.3)

---

## Out of scope (consumer owns — do NOT add to this library)

- **Egress-Only IGW** for IPv6 egress route (VPC/route-table). (RC5.1)
- **fck-nat** single-AZ IPv4 egress (consumer VPC instance + route). (RC5.2)
- **The ingest Lambda + its SG** — 55minutes `CrewIngress`; the construct only *accepts* the SG as
  `webhookIngress.source`. (RC5.3)

## Definition of done (whole change set)

- `enableIpv6`, `webhookIngress`, `webhookTokenSecretArn`, `crewRuntime` all land as optional props,
  each behind a test, each backward-compatible.
- No-prop synth (RC0.1) and no-prop `bootstrap.sh` (RC0.2) proven byte-unchanged.
- The 55minutes brain posture is achievable purely from props; EIGW/fck-nat/ingest-Lambda stay in
  the consumer.
- `npx projen build` green; README carries the private-brain example.
