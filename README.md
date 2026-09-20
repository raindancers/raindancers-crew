# @raindancers/raindancers-crew

A CDK construct that provisions a **self-hosted [KiroCrew](https://github.com/kirodotdev/KiroCrew) gateway** on a single EC2 instance in your own AWS account, reached over **SSM Session Manager** — no inbound ports, no SSH key.

It is a pipeline-native, version-controlled port of the upstream `kirocrew-ec2` CloudFormation template. Where the native `kirocrew cloud launch` is an imperative one-shot, this construct lets you deploy the same shape **through your own CDK pipeline**, under **your** naming, permissions boundary, and OIDC deploy role — so a remote crew becomes a reviewed, repeatable, diffable artifact like everything else you ship.

## Usage

```ts
import { RemoteCrewInstance, CrewArchitecture } from '@raindancers/raindancers-crew';

new RemoteCrewInstance(this, 'Crew', {
  vpc,
  permissionsBoundaryArn: 'arn:aws:iam::123456789012:policy/kirocrew-ec2-boundary',
  architecture: CrewArchitecture.ARM64,
  instanceType: new ec2.InstanceType('m7g.2xlarge'),
  // Pin a released tag for reproducible deploys — defaults to `main`, which drifts.
  source: { kirocrewRef: 'v0.8.0' },
});
```

## What it creates

| Resource | Notes |
|---|---|
| IAM role + instance profile | `AmazonSSMManagedInstanceCore` + a **required permissions boundary**; scoped `s3:GetObject` only when an S3 source is used |
| Security group | **No inbound** by default (SSM-only); optional `tcp/22` from `allowSshCidr` (≤ /16) |
| EC2 instance | Amazon Linux 2023, arch-aware AMI, **IMDSv2 enforced**, **encrypted gp3** root |
| WaitConditionHandle + WaitCondition | Blocks stack completion until the gateway is actually serving on the loopback dashboard port |

## Security posture (preserved from upstream)

- **SSM-only access.** No inbound rules unless you explicitly pass `allowSshCidr`. Access is via SSM port-forward; the public DNS is diagnostics only.
- **IMDSv2 required, hop limit 1.** KiroCrew runs a prompt-injectable agent that executes arbitrary tools — an SSRF/injection reaching the metadata endpoint must not be able to read the role's STS credentials via IMDSv1.
- **Permissions boundary is mandatory** on the instance role.
- **Node.js tarball is SHA-256-pinned** and verified before root extraction.
- **Encrypted EBS root.**

## Connecting

This construct provisions the box; **connection stays an operator action** (it is inherently imperative — mint a short-lived token on the instance and open an SSM port-forward). Use the upstream `kirocrew cloud connect` against the deployed instance id, or your own SSM `start-session` / port-forward wrapper.

## License

Apache-2.0
