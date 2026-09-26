# Build spec: three isolated Kiro Crew instances on one m9g, as ECS-on-EC2 container tasks, via the raindancers-crew construct

Status: build spec for review. Nothing here is applied. This is a spec only: no git, no AWS calls, no installs. It lists the concrete bits to ADD to the raindancers-crew CDK construct so ONE self-provisioned EC2 (m9g, Graviton5, arm64) runs three isolated Kiro Crew instances as ECS-on-EC2 container tasks, and how the 55minutes repo instantiates that construct as the consumer.

This spec supersedes the microVM shape in `/home/frazera/.kiro/crew/scratch/spec-firecracker-crew-construct.md` for this workload. It DELETES the whole Firecracker/jailer/microVM layer (see section 5). That older spec is left in place untouched; this is a separate, alternative build.

Convention used throughout: VERIFIED means read directly from source in `/home/frazera/.kiro/crew/scratch/rc-repo`. PROPOSED means new work this spec is asking for. ESTIMATE means a number to tune, not a measured fact.

Real files this spec touches (all confirmed present):
- `src/remote-crew-instance-props.ts` (VERIFIED, 5825 bytes)
- `src/remote-crew-instance.ts` (VERIFIED, 12220 bytes)
- `src/fargate-crew-base.ts` (VERIFIED, exists, holds `ecs.Cluster` + egress-only SG)
- `src/fargate-crew.ts` (VERIFIED, exists, holds per-crew task role, execution role, log group)
- `src/crew-backup-bucket.ts` (VERIFIED, `RemovalPolicy.RETAIN` default)
- `src/index.ts` (VERIFIED, barrel exporting all of the above)
- `src/assets/bootstrap.sh` (VERIFIED), `src/assets/backup.sh`, `src/assets/restore-from-s3.sh`

## 1. Goal

Add an ECS-on-EC2 lane to the raindancers-crew construct so one operator-owned m9g EC2 instance, running the ECS agent and registered to an ECS cluster, hosts `crewCount` Kiro Crew instances as ECS tasks (one task/service per crew, default 3 for the 55minutes consumer). Each task runs in awsvpc mode with its own ENI and private VPC IP; the host does the NAT so tasks stay fully private with no public IPs; each crew keeps its durable `~/.kiro/crew` state on its own encrypted EBS volume that survives instance replacement. Isolation is container-level (shared kernel), accepted as sufficient: Graviton5 Nitro protects the box from other AWS tenants, containers cover crew-to-crew. The construct default stays a single crew so existing consumers are untouched; everything here is strictly additive.

## 2. VERIFIED current-construct baseline

Read directly from source. Nothing in this section is proposed; it is what the construct does today.

### 2a. RemoteCrewInstance (EC2 lane) - `src/remote-crew-instance.ts`, `src/remote-crew-instance-props.ts`

- `vpc: ec2.IVpc` is a REQUIRED prop (consumer passes it). VERIFIED.
- `permissionsBoundaryArn: string` is REQUIRED and applied to the instance role via `iam.ManagedPolicy.fromManagedPolicyArn` (`assumedBy: ec2.amazonaws.com`, managed policy `AmazonSSMManagedInstanceCore`). VERIFIED.
- `instanceType?: ec2.InstanceType`, default `m7g.2xlarge` for ARM64 (or `m7i.2xlarge` for x86_64). VERIFIED. So the instance type IS already a settable parameter; the m9g size is a consumer choice, not a new construct default.
- `architecture?: CrewArchitecture` default `ARM64`. The ARM64 branch selects `ec2.AmazonLinuxCpuType.ARM_64` and `ec2.MachineImage.latestAmazonLinux2023({ cpuType })` (no hardcoded AMI id). VERIFIED.
- `volumeSizeGb?: number` default 60. The single root block device is `/dev/xvda`, `ec2.BlockDeviceVolume.ebs(...)` with `volumeType: GP3`, `encrypted: true`, `deleteOnTermination: true`. VERIFIED. (The old Firecracker spec called the root default 20 GiB in one place; the real default is 60. See DIVERGENCE list.)
- `requireImdsv2: true` on the instance (IMDSv2 enforced so the prompt-injectable agent cannot read role creds via IMDSv1). VERIFIED.
- Security group is SSM-only: `allowAllOutbound: true`, no inbound unless `allowSshCidr` is set (validated by a CIDR regex no wider than /16). VERIFIED.
- `associatePublicIp?: boolean` default `true`; `vpcSubnets?: ec2.SubnetSelection` default `{ subnetType: ec2.SubnetType.PUBLIC }`. VERIFIED.
- Backup wiring: `backupBucket?: ICrewBackupBucket`, `backupSchedule?` (default `daily`), `backupPrefix?` (default `crew-snapshots/`). When set, grants write+read, writes `/etc/kirocrew/backup.env`, installs `/usr/local/sbin/kirocrew-backup` and `kirocrew-restore-from-s3`, plus `kirocrew-backup.service` and `.timer`. VERIFIED.
- `CfnWaitConditionHandle` + `CfnWaitCondition` health gate, `bootstrapTimeoutMinutes?` default 25, `count: 1`, depends on the CfnInstance. VERIFIED.
- Stack outputs `kirocrew-<stackTag>-instance-id` and `kirocrew-<stackTag>-public-dns` (public DNS is diagnostics only). VERIFIED.
- `source?: CrewSource` (S3 tarball via `sourceBucket`/`sourceKey`, else git clone of `kirocrewRepo`@`kirocrewRef`, default `kirodotdev/KiroCrew`@`main`), `stackTag?` (default `kirocrew`, regex `^[a-zA-Z0-9-]{1,51}$`), `dashboardPort?` (default 5476). VERIFIED.
- UserData mechanism: the construct reads `src/assets/bootstrap.sh` at synth (via a `resolveAsset` helper that walks `src/` for tests and `../src/assets` for compiled consumers), prepends a header of `WAIT_HANDLE`/`DASHBOARD_PORT`/`SOURCE_*`/`KIROCREW_*` env vars, then appends the script body. VERIFIED.

### 2b. Existing ECS lane (this is the important baseline for this spec)

The construct ALREADY has a container/ECS lane. This is the biggest divergence from the old Firecracker spec, which described it only as "the Fargate lane, untouched, simply not used". For an ECS-on-EC2 build it is a reusable foundation, not dead weight.

- `src/fargate-crew-base.ts` defines `FargateCrewBase`: creates an `ecs.Cluster` (`clusterName: kirocrew-crew-<stackTag>`, `containerInsightsV2: DISABLED`) in the passed `vpc`, plus an egress-only task security group (`allowAllOutbound: true`, NO inbound). It documents itself as "ONE per account and region" and notes awsvpc placement (`vpcSubnets?: ec2.SubnetSelection`, "each must be able to reach the container registry"). VERIFIED.
- `src/fargate-crew.ts` defines `FargateCrew`: one per crew. Creates a per-crew execution role (`kirocrew-crew-<crew>-exec`, scoped secret read `kirocrew/crew/<crew>/*`, `logs:CreateLogStream`+`PutLogEvents`, optional scoped ECR pull), a per-crew task role (`kirocrew-crew-<crew>-task`, created with NO policies, MUST NEVER get `secretsmanager:GetSecretValue`), and a per-crew log group (`/kirocrew/crew/<crew>`, retention prop). Both roles carry an optional crew boundary and an `aws:SourceAccount` assume condition. `crew` name regex `^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`. VERIFIED.
- `FargateCpuArchitecture` enum (`X86_64` default, `ARM64`) on `FargateCrewBase`. VERIFIED.

What is NOT present today (VERIFIED by reading the files): neither ECS construct creates a `TaskDefinition`, a container definition, an `Ec2Service`/`FargateService`, an ASG or `AsgCapacityProvider`, or any EC2 capacity for the cluster. The cluster exists but has no capacity registered and no task definition to run. The per-crew IAM + log-group scaffolding exists; the "actually run a container" resources do not. That gap is exactly what this spec fills for the EC2 case.

### 2c. CrewBackupBucket - `src/crew-backup-bucket.ts`

- Hardened S3 bucket: SSE-KMS (rotating key), `BLOCK_ALL` public access, `enforceSSL: true`, versioned, lifecycle expiry of noncurrent versions (default 90 days). `removalPolicy` default `RemovalPolicy.RETAIN` (and the KMS key RETAIN too). Implements `ICrewBackupBucket` with `grantWrite`/`grantRead`. VERIFIED. This RETAIN intent is the model for the per-crew EBS `deleteOnTermination: false` decision in section 3.

## 3. Additive changes: CONSTRUCT (heavy lifting) vs 55minutes CONSUMER (thin)

The construct does the heavy lifting; the 55minutes repo is a thin consumer that supplies only its own facts (VPC, subnets, permissions boundary ARN, region, instance type, crew count) as props and CDK context and holds no ECS, networking, or provisioning logic of its own. No AWS resource ID is hardcoded inside the construct (hard rule): every account-specific or environment-specific value is a prop the consumer passes.

### 3a. CONSTRUCT changes

New or extended construct surface. A new dedicated construct is cleaner than overloading `RemoteCrewInstance`, but it reuses the verified EC2 provisioning (boundary, IMDSv2, encrypted gp3 root, SSM-only SG, bootstrap-asset mechanism, WaitCondition) and the verified ECS scaffolding (`FargateCrewBase` cluster, `FargateCrew` roles/log groups).

PROPOSED new construct: `EcsCrewHost` in a new file `src/ecs-crew-host.ts`, exported from `src/index.ts`. It provisions the single ECS-registered m9g and, per crew, one EC2 task definition + service + EBS data volume, plus the two-subnet host-NAT networking. Rationale for a new construct rather than a `RemoteCrewInstance` flag: the EC2 lane today is "one box runs the gateway directly", and ECS-on-EC2 is "one box runs the ECS agent and hosts N task ENIs behind host NAT". Those are different enough shapes that a variant flag on `RemoteCrewInstance` would be a maze of `if (ecs)` branches. This mirrors the existing choice to keep `FargateCrewBase`/`FargateCrew` separate from `RemoteCrewInstance`. (OPEN, section 5: confirm new-construct vs extend-RemoteCrewInstance.)

New props (PROPOSED) on `EcsCrewHostProps`:

- `vpc: ec2.IVpc` (required). Passed in, never created here.
- `permissionsBoundaryArn: string` (required). Applied to the instance role AND every per-crew task/execution role, matching the existing mandatory-boundary discipline (VERIFIED that `RemoteCrewInstanceProps.permissionsBoundaryArn` is required; the crew boundary on `FargateCrew` is optional today, but this spec passes it since the consumer has one).
- `instanceType?: ec2.InstanceType` (default `m7g.2xlarge` to match `RemoteCrewInstance`; the 55minutes consumer passes `new ec2.InstanceType('m9g.large')` or `m9g.xlarge`). The instance type STAYS a CDK parameter.
- `crewCount?: number` (CONSTRUCT DEFAULT = 1). One is identical to today's single-crew behaviour and protects existing consumers. The 55minutes consumer passes 3. Validate 1 to a small max (say 8). Strictly additive.
- `crews?: string[]` or a derived list. Per-crew names feed the existing `FargateCrew` `crew` regex (`^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`) and derive log group / role / secret namespace. Default `['crew-1', 'crew-2', 'crew-3']` sliced to `crewCount`.
- `crewDataVolumeSizeGb?: number` (default 20 ESTIMATE). Per-crew durable EBS size, always encrypted.
- `crewDataVolumeType?: ec2.EbsDeviceVolumeType` (default `GP3`).
- `crewMemoryHardLimitMiB?: number` (ESTIMATE, see section 3a task-def) and `crewMemoryReservationMiB?: number` (soft) and optional `crewCpuShares?: number` (soft).
- `ecrRepositoryArn?: string` (optional; passed through to per-crew execution roles for a scoped pull grant, else public registry).
- `backupBucket?: ICrewBackupBucket`, `backupSchedule?`, `backupPrefix?` (reuse the existing types/wiring per crew).
- `stackTag?: string` (default `kirocrew`, same regex).
- `region`/`account` are NOT props: they come from the consumer's `Stack` env (VERIFIED that `RemoteCrewInstance` reads `Stack.of(this).region`, never a region prop).

Resources the construct creates (PROPOSED, reusing verified pieces):

1. ECS cluster: reuse `FargateCrewBase` (its `ecs.Cluster`), or create an `ecs.Cluster` directly in `EcsCrewHost`. Since `FargateCrewBase` disables container insights and names the cluster from the tag, reusing it keeps one code path. VERIFIED `FargateCrewBase` already builds exactly this cluster.
2. EC2 capacity: ONE self-provisioned m9g. Two shapes to pick from (OPEN, section 5):
   - (a) A minimal Auto Scaling Group of size 1 with an `ecs.AsgCapacityProvider`, ECS-optimized arm64 AL2023 AMI (`ecs.EcsOptimizedImage.amazonLinux2023(ecs.AmiHardwareType.ARM)`), the ECS agent joining the cluster automatically. This is the CDK-idiomatic path and gives the WaitCondition-equivalent via ECS capacity provider health.
   - (b) A single `ec2.Instance` (mirroring `RemoteCrewInstance`) whose UserData joins the ECS cluster (`echo ECS_CLUSTER=<name> >> /etc/ecs/ecs.config`) plus the host-NAT bootstrap. This reuses the verified `RemoteCrewInstance` provisioning shape (IMDSv2, encrypted gp3 root, SSM-only SG, boundary, bootstrap asset) but must self-register to ECS.
   RECOMMENDED default: (b) single `ec2.Instance`, because it reuses the whole verified EC2 hardening and bootstrap-asset mechanism and matches "ONE self-provisioned EC2 instance the user owns" literally, and because a size-1 ASG buys little here (no scaling intended). Keep the instance's root volume the verified encrypted gp3 `/dev/xvda`.
3. Per-crew EBS data volumes: `crewCount` extra `ec2.CfnVolume` (or `blockDevices` entries on the instance), each `encrypted: true`, `volumeType: GP3`, `deleteOnTermination: false` (matching the `CrewBackupBucket` RETAIN intent so crew memory outlives an instance replacement). Attached to the host; the bootstrap mounts each under a per-crew path and each ECS task bind-mounts its own crew directory. Resolve devices by a stable attribute (NVMe volume mapping or a filesystem label written at provision time), NOT by assuming `/dev/sdf` equals the kernel device name (see cautions, section 6).
4. Per-crew ECS task definition + service:
   - `ecs.Ec2TaskDefinition` per crew, `networkMode: ecs.NetworkMode.AWS_VPC` (awsvpc, so each task gets its own ENI + private VPC IP), `taskRole` and `executionRole` from a reused `FargateCrew` (VERIFIED those roles exist), `runtimePlatform` arm64.
   - One container definition per task: the Kiro Crew image (public registry or scoped ECR), `memoryReservationMiB` (soft, so idle crews cost little), a hard `memory` cap (so no crew OOMs the others past its ceiling), optional soft `cpu` shares, log driver to the per-crew `/kirocrew/crew/<crew>` log group (VERIFIED that log group already exists in `FargateCrew`).
   - A bind mount / host volume mapping the crew's mounted EBS path into the container so `~/.kiro/crew` is durable.
   - `ecs.Ec2Service` per crew, `desiredCount: 1`, placed on the awsvpc private subnet with the egress-only task SG (VERIFIED `FargateCrewBase` builds that SG), `assignPublicIp` NOT set (tasks are fully private).
5. Networking: ONE small VPC is the consumer's to pass, but the construct creates/asserts the two-subnet host-NAT topology and the host-NAT bootstrap:
   - PUBLIC subnet: holds the host ENI + Elastic IP + a route to the IGW.
   - PRIVATE subnet: holds the crew task ENIs, route `0.0.0.0/0` -> the host ENI (the host does NAT). NO IGW route.
   - Host NAT ("option B", host iptables NAT): the bootstrap sets `net.ipv4.ip_forward=1`, adds an iptables `MASQUERADE` rule on the host egress interface, and the construct DISABLES source/dest check on the host ENI (`ec2.CfnInstance` `sourceDestCheck: false`, or a `CfnNetworkInterface` with `SourceDestCheck: false`). Tasks have NO public IPs.
   - EXPLICITLY no NAT Gateway, no fck-nat service, no VPC endpoints, no ALB, no PrivateLink.
6. Host-NAT + ECS-join bootstrap: extend the existing bootstrap-asset mechanism (VERIFIED: construct reads an asset, prepends a header, appends the body). Add a new asset (for example `src/assets/ecs-host-bootstrap.sh`) or extend `bootstrap.sh` with the ECS-host steps: write `/etc/ecs/ecs.config` with `ECS_CLUSTER=<name>` and awsvpc trunking enabled, enable IP forwarding, install the MASQUERADE iptables rule (persisted), mount each per-crew EBS volume (resolve-by-label), and keep the resumable-systemd discipline (VERIFIED the bootstrap already installs resumable oneshot units). The header gains `ECS_CLUSTER`, `CREW_COUNT`, and the per-crew volume-label list.
7. Optional `CrewWebhookIngress` sub-construct (PROPOSED, composable, mirrors `CrewBackupBucket`): each task has a real private VPC IP, so a Lambda-in-VPC can POST to a crew's `POST /api/hooks/agent` directly with NO VPC endpoint. Keep it a separate, optional construct the consumer instantiates and wires, exactly as `CrewBackupBucket` is optional and passed in. It creates (or references) an SNS topic and an in-VPC arm64 Lambda under the same boundary, plus a scoped task-SG ingress rule from the Lambda SG on the crew port only (the one controlled inbound exception to the egress-only model; state it in the README). NOTE: an earlier grep found NO RC2/RC3 webhook-token handling in the construct; confirmed still absent in this read (no hook/webhook/sns references in `src/`). Treat ingress as greenfield and say so; do not build it speculatively.
8. Backup per crew: reuse `src/assets/backup.sh` and `restore-from-s3.sh` (VERIFIED) with a per-crew prefix, or grant the per-crew task role write to the backup bucket so the running container pushes its own snapshots (VERIFIED `FargateCrew` already grants the TASK role backup write when `backupBucket` is set).

### 3b. 55minutes CONSUMER changes (thin)

A concrete stack in the 55minutes repo that imports the construct and passes real values. No AWS IDs hardcoded in the construct; the consumer supplies them here from CDK context or a config file it owns.

Facts the consumer supplies:
- Workload account 641001211783 via the `crew` profile; deploy account 969169896298 via `crew-deploy`.
- Region: Sydney `ap-southeast-2` (default here). Control plane is Auckland `ap-southeast-6`. Auckland has NO m9g, so the crews run in Sydney: this is a deliberate, flagged cross-region choice, added as a stack comment so it is visible, not accidental. `us-east-1` is the alternative if larger capacity is wanted.
- VPC, the two subnets (public host + private tasks), and the permissions boundary ARN for account 641001211783.
- `instanceType: new ec2.InstanceType('m9g.large')` (or `m9g.xlarge`), `crewCount: 3`.

Illustrative sketch (NOT final code):

```
const app = new App();
const stack = new Stack(app, 'FiftyFiveCrewFleet', {
  env: { account: '641001211783', region: 'ap-southeast-2' }, // Sydney; control plane is Auckland ap-southeast-6 (cross-region, deliberate: no m9g in Auckland)
});

const vpc = ec2.Vpc.fromLookup(stack, 'Vpc', { vpcId: /* from context */ });
const backup = new CrewBackupBucket(stack, 'Backup', {});

const host = new EcsCrewHost(stack, 'CrewFleet', {
  vpc,
  permissionsBoundaryArn: /* account-641001211783 boundary ARN, from context */,
  instanceType: new ec2.InstanceType('m9g.large'),
  crewCount: 3,
  crewDataVolumeSizeGb: 20,
  backupBucket: backup,
  stackTag: 'fiftyfive',
});

// Optional, greenfield, only if inbound webhooks are needed:
// new CrewWebhookIngress(stack, 'Webhook', { vpc, host, crewCount: 3, permissionsBoundaryArn: /* same, from context */ });
```

Every value marked "from context" is read from CDK context or a config file the 55minutes repo owns, not baked into the construct. Region is set on the stack env, not the construct.

## 4. Removed vs the old Firecracker spec

Nothing is removed from the EXISTING construct. The single-crew EC2 shape and the ECS scaffolding both stay; a `crewCount` of 1 with no webhook ingress is behaviourally what exists today.

What this spec DELETES relative to the old Firecracker spec: the entire microVM layer. No Firecracker, no jailer, no microVMs, no tap-per-VM + bridge, no per-VMM systemd jailer units, no cgroup-v2 slices around VMMs, no shared guest kernel/rootfs build, no host-side webhook adapter forwarding to guest gateway ports. ECS-on-EC2 replaces all of it: container isolation (shared kernel) is accepted as sufficient because Graviton5 Nitro Isolation protects the box from other AWS tenants and containers cover crew-to-crew separation. The old spec's sections 3.1-3.7 (Firecracker install, guest image, jailer units, tap/bridge, cgroup slices, host adapter) are all gone.

## 5. Additive-guard note

The construct default MUST NOT change behaviour for existing consumers. `crewCount` defaults to 1 at the construct level; the 55minutes consumer passes 3. A plain instantiation with no new props behaves as today. The old Firecracker spec's "default 3" was the consumer's value, not the construct default; this spec keeps 1 as the construct default and states it plainly.

## 6. Ordered task list (bounded steps)

Construct first, then consumer.

1. Add `EcsCrewHostProps` and the `EcsCrewHost` skeleton in `src/ecs-crew-host.ts`; export from `src/index.ts`. Add prop validation (`crewCount` 1..8, crew-name regex reuse, boundary required).
2. Create the ECS cluster (reuse `FargateCrewBase` or create `ecs.Cluster` in the new construct).
3. Create the single ECS-registered m9g EC2 capacity: recommended path is one `ec2.Instance` mirroring `RemoteCrewInstance` hardening (IMDSv2, encrypted gp3 `/dev/xvda`, SSM-only SG, boundary, resumable bootstrap) whose UserData joins the cluster via `/etc/ecs/ecs.config`; instance type stays a prop. (Alternative: size-1 ASG + `AsgCapacityProvider`.)
4. Per-crew EC2 task definition (`ecs.Ec2TaskDefinition`, `networkMode: AWS_VPC`, arm64 runtime, reused `FargateCrew` task+execution roles and `/kirocrew/crew/<crew>` log group) and container definition.
5. awsvpc networking + two subnets + host-NAT bootstrap: assert/consume PUBLIC subnet (host ENI + EIP + IGW route) and PRIVATE subnet (task ENIs, `0.0.0.0/0` -> host ENI, no IGW); disable source/dest check on the host ENI; bootstrap sets `ip_forward=1` and iptables `MASQUERADE`.
6. Per-crew EBS data volume (`encrypted`, `GP3`, `deleteOnTermination: false`) + host mount (resolve-by-label) + container bind mount for `~/.kiro/crew`.
7. Soft `memoryReservationMiB` + optional soft `cpu`, and a hard per-task `memory` cap, per crew.
8. Per-crew `ecs.Ec2Service` (`desiredCount: 1`, private subnet, egress-only task SG, no public IP).
9. Reuse per-crew backup (per-crew prefix, or task-role write to the backup bucket, both already supported by `FargateCrew`/the backup assets).
10. Optional `CrewWebhookIngress` sub-construct (`src/crew-webhook-ingress.ts`, greenfield: SNS + in-VPC arm64 Lambda under boundary + scoped task-SG ingress rule), export from `src/index.ts`. Build only if inbound webhooks are needed.
11. Add/extend jest tests (`test/ecs-crew-host.test.ts`, and a new `test/crew-webhook-ingress.test.ts` if built) asserting the cluster, capacity, per-crew task defs/services, EBS volumes, subnets, host-NAT source/dest-check, soft/hard limits, and that `crewCount` default 1 synthesizes one crew.
12. Run the full `npx projen build` (eslint + test + synth + package) as the done gate. Green there is the bar (the subset jest+synth is not enough: eslint runs in CI's build).
13. Update `README.md` and `API.md` for the new construct, props, the ECS-on-EC2 shape, the two-subnet host-NAT model, and the one scoped inbound SG exception (webhook, if built).

Consumer (55minutes):

14. Create the `FiftyFiveCrewFleet` stack importing `EcsCrewHost`, `CrewBackupBucket`, and (optionally) `CrewWebhookIngress`, in account 641001211783 via the `crew` profile.
15. Supply VPC, the two subnets, permissions boundary ARN, region (Sydney), instance type (m9g.large/xlarge), and crew count (3) from context.
16. Add the cross-region comment (crews Sydney, control plane Auckland).
17. Synth and review the consumer stack (no deploy in this spec's scope).

Ordered task-step count: 17 (13 construct steps, 4 consumer steps).

## 7. Open decisions (with recommended defaults)

1. New construct vs extend `RemoteCrewInstance`. RECOMMENDED: new `EcsCrewHost` construct (reuses `FargateCrewBase`/`FargateCrew` + `RemoteCrewInstance` hardening), because ECS-on-EC2 is a different enough shape that a variant flag would branch heavily. Confirm.
2. Capacity shape: single `ec2.Instance` (RECOMMENDED, reuses verified hardening, matches "one self-provisioned EC2") vs size-1 ASG + `AsgCapacityProvider` (CDK-idiomatic but adds an ASG for no scaling benefit). Confirm.
3. Region: Sydney `ap-southeast-2` (RECOMMENDED, nearest m9g to the Auckland control plane) vs `us-east-1` (largest capacity). Auckland is OUT (no m9g).
4. Start size: m9g.large (cheapest, tight for three tasks + host ENIs, confirm ENI budget in section 8) vs m9g.xlarge (comfortable). Instance type is a prop either way.
5. Overcommit vs hard caps: soft `memoryReservationMiB` allowing the sum of reservations to exceed nothing while hard `memory` caps sum near or below physical RAM minus host headroom (RECOMMENDED: soft reservation for scheduling, hard `memory` per task so a runaway crew cannot exceed its ceiling; accept the host OOM cross-crew blast-radius caveat in section 8).
6. Per-crew durable data: EBS (RECOMMENDED default, small gp3 per crew, `deleteOnTermination: false`) vs EFS (alternative, one filesystem with per-crew access points, survives instance loss without re-attach but adds an NFS mount and cost). Default EBS.
7. Webhook reuse: no RC2/RC3 webhook-token code found in the construct. Confirm whether that handling exists elsewhere (another repo or the upstream KiroCrew runtime) to reuse, rather than building the Lambda + host handler fresh.

## 8. Honest cautions

- Host OOM cross-crew blast radius: containers share the host kernel, so if the sum of actual usage exceeds physical RAM the host OOM-killer can kill a process in ANY crew's container, not only the crew that overcommitted. Hard per-task `memory` caps bound each task's ceiling but do NOT prevent the aggregate from exceeding RAM when reservations are soft. Set the sum of hard `memory` caps at or below (physical RAM minus host + ECS-agent headroom) if a hard guarantee is wanted; otherwise accept that a busy crew can pressure siblings. This is real and cannot be designed away at the container layer; it is the accepted cost of shared-kernel isolation vs microVMs.
- awsvpc ENI-per-task limit: awsvpc mode gives each task its own ENI, which counts against the instance's ENI limit. The host itself uses one ENI (public subnet); three crew task ENIs plus the host ENI is four ENIs. Confirm the chosen m9g size supports at least (crewCount + 1) ENIs (m9g.large and m9g.xlarge ENI limits are ESTIMATE until checked against the current EC2 ENI-per-instance-type table; ECS "ENI trunking"/awsvpcTrunking raises the per-instance task-ENI budget and may be needed on smaller sizes). This is a hard capacity gate: if the size cannot carry crewCount + 1 ENIs, either enable ENI trunking or step up the instance size. Mark VERIFY-BEFORE-BUILD.
- EBS NVMe device naming: on Nitro (all Graviton), a CDK/EBS device name like `/dev/sdf` surfaces as `/dev/nvme1n1`, and the number is not stable across reattach. The bootstrap MUST resolve each per-crew volume by a stable attribute (a filesystem label written at first provision, or the NVMe volume-id mapping), NOT by hardcoding `/dev/sdf`. Getting this wrong mounts the wrong crew's state into a container. Flagged as an implementation detail for the bootstrap, ESTIMATE on exact resolve mechanism.
- ECS agent + host NAT interaction: the host runs both the ECS agent (managing task ENIs) and iptables MASQUERADE for task egress. Confirm during build that awsvpc task ENIs route through the host's MASQUERADE correctly and that the ECS agent's own CNI plumbing does not conflict with the host NAT rules. Mark VERIFY-BEFORE-BUILD.

## 9. Where the real construct source DIVERGED from the old Firecracker spec's claims

- BIGGEST: the old spec described the ECS/Fargate lane as merely "untouched and simply not used". In fact `src/fargate-crew-base.ts` and `src/fargate-crew.ts` are a substantial, verified ECS foundation (an `ecs.Cluster`, an egress-only awsvpc task SG, per-crew task role, execution role with scoped secret read, and per-crew log group). For an ECS-on-EC2 build this is reusable baseline, not dead weight. This spec builds ON it.
- The old spec's section 2a said the per-crew data-volume default was 20 GiB and, separately, referenced the root volume; the REAL root-volume default in `remote-crew-instance-props.ts` is `volumeSizeGb` default 60 (not 20). The 20 was the proposed per-crew data volume, kept as an ESTIMATE here.
- The old spec proposed a `crewCount` default of 3 "in the design doc" and had to add a guard note that the CONSTRUCT default must be 1. Confirmed here: nothing in the current source has any `crewCount`, so it is genuinely new and this spec sets the construct default to 1 from the outset.
- The old spec's `CrewWebhookIngress` assumed a possible per-crew VPC endpoint. For ECS-on-EC2 with awsvpc, each task already has a real private VPC IP, so a Lambda-in-VPC reaches it directly and NO VPC endpoint is needed. Simpler than the microVM host-adapter fan-out the old spec described.
- Confirmed still true: no `hook`/`webhook`/`sns`/`firecracker`/`jailer` references anywhere in `src/` (the old spec's grep finding holds), so webhook ingress remains greenfield.
