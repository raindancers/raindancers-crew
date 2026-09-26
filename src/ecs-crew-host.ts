import * as fs from 'fs';
import * as path from 'path';
import { Stack, Tags, Token } from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { FargateCrew } from './fargate-crew';
import { FargateCpuArchitecture, FargateCrewBase } from './fargate-crew-base';
import { CrewArchitecture, ICrewBackupBucket } from './remote-crew-instance-props';

const STACK_TAG_RE = /^[a-zA-Z0-9-]{1,51}$/;
const CREW_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

const DEFAULT_STACK_TAG = 'kirocrew';
const DEFAULT_CREW_COUNT = 1;
const MAX_CREW_COUNT = 8;
const DEFAULT_ROOT_VOLUME_GB = 60;
const DEFAULT_CREW_VOLUME_GB = 20;
const DEFAULT_MEMORY_RESERVATION_MIB = 1024;
const DEFAULT_MEMORY_HARD_LIMIT_MIB = 2048;

/**
 * How a per-crew durable EBS volume is exposed to the host and its container.
 *
 * The device name the construct asks for (for example `/dev/sdf`) is NOT the
 * kernel device name on Nitro/Graviton, where every EBS volume surfaces as an
 * unpredictable `/dev/nvmeXn1`. The bootstrap therefore resolves each volume by
 * a stable filesystem LABEL, never by the device path.
 */
export interface CrewDataVolume {
  /** The crew this volume belongs to. */
  readonly crew: string;
  /** The block device name requested at attach time (a hint, not the kernel name). */
  readonly deviceName: string;
  /** The stable filesystem label the bootstrap resolves and mounts by. */
  readonly label: string;
  /** The host mount path the container bind-mounts for `~/.kiro/crew`. */
  readonly mountPath: string;
}

/**
 * Properties for {@link EcsCrewHost}.
 */
export interface EcsCrewHostProps {
  /**
   * VPC to run in. Passed in, never created here.
   *
   * The construct consumes a two-subnet host-NAT topology it does not build:
   * one PUBLIC subnet (host ENI + Elastic IP + IGW route) and one PRIVATE
   * subnet (task ENIs, `0.0.0.0/0` -> the host ENI, no IGW route). Select them
   * with {@link hostSubnets} and {@link taskSubnets}.
   */
  readonly vpc: ec2.IVpc;

  /**
   * ARN of an IAM permissions boundary applied to the host instance role.
   *
   * The host runs a prompt-injectable agent per crew, so its role MUST carry a
   * boundary that caps blast radius. Required, not optional, matching
   * {@link RemoteCrewInstanceProps.permissionsBoundaryArn}. Any valid managed-
   * policy ARN is accepted here (this is the EC2/host boundary).
   *
   * The per-crew task/execution roles take {@link crewPermissionsBoundaryArn},
   * which is validated separately against the `kirocrew-crew-boundary` pattern
   * the crew roles require.
   */
  readonly permissionsBoundaryArn: string;

  /**
   * ARN of the pre-created shared crew permissions boundary
   * (`arn:aws:iam::<account>:policy/kirocrew-crew-boundary`), applied to every
   * per-crew task and execution role.
   *
   * Separate from {@link permissionsBoundaryArn} because the crew roles enforce
   * the `kirocrew-crew-boundary` policy name (a different boundary from the
   * host's), and validating them together would force one ARN to satisfy two
   * distinct patterns. Optional, mirroring {@link FargateCrew}'s declared
   * degraded mode: omit it only when no crew-boundary creator exists yet.
   *
   * @default - no crew boundary (declared degraded mode; see FargateCrew)
   */
  readonly crewPermissionsBoundaryArn?: string;

  /**
   * EC2 instance type for the single ECS-registered host.
   *
   * The type STAYS a settable prop: the 55minutes consumer passes
   * `new ec2.InstanceType('m9g.xlarge')`. Never hardcoded to one family.
   *
   * @default - m7g.2xlarge (arm64) / m7i.2xlarge (x86_64), matching
   * RemoteCrewInstance
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * CPU architecture of the host and the crew container images. Must match
   * {@link instanceType} when that is set.
   *
   * @default CrewArchitecture.ARM64
   */
  readonly architecture?: CrewArchitecture;

  /**
   * Number of Kiro Crew instances to host, each one ECS task/service.
   *
   * DEFAULT 1 — identical to today's single-crew behaviour, so existing
   * consumers gain nothing new. The 55minutes consumer passes 3. Validated
   * 1..8: awsvpc gives each task its own ENI, and (crewCount + 1) ENIs (the
   * host ENI plus one per task) must fit the instance type's ENI budget.
   *
   * @default 1
   */
  readonly crewCount?: number;

  /**
   * Explicit crew names. Each must match the {@link FargateCrew} regex
   * `^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`; the log group, roles, and secret
   * namespace are derived from it. When omitted, names are generated as
   * `crew-1`..`crew-<crewCount>`. When set, the list length must equal
   * {@link crewCount}.
   *
   * @default - crew-1 .. crew-<crewCount>
   */
  readonly crews?: string[];

  /**
   * Subnet selection for the host ENI. This is the PUBLIC subnet (IGW-routed,
   * carries the Elastic IP), because the host does the NAT for the tasks.
   *
   * @default - one public subnet in the VPC
   */
  readonly hostSubnets?: ec2.SubnetSelection;

  /**
   * Subnet selection for the crew task ENIs. This is the PRIVATE subnet whose
   * `0.0.0.0/0` route points at the host ENI (no IGW route). Tasks get no
   * public IP.
   *
   * @default - the VPC's private-with-egress subnets
   */
  readonly taskSubnets?: ec2.SubnetSelection;

  /**
   * gp3 root volume size in GiB for the host. Always encrypted.
   *
   * @default 60
   */
  readonly rootVolumeSizeGb?: number;

  /**
   * Per-crew durable EBS data volume size in GiB. Always encrypted, always
   * `deleteOnTermination: false` (a crew's `~/.kiro/crew` learnings must
   * outlive an instance replacement, matching the CrewBackupBucket RETAIN
   * intent).
   *
   * @default 20
   */
  readonly crewDataVolumeSizeGb?: number;

  /**
   * Per-crew EBS volume type.
   *
   * @default ec2.EbsDeviceVolumeType.GP3
   */
  readonly crewDataVolumeType?: ec2.EbsDeviceVolumeType;

  /**
   * SOFT memory reservation (MiB) per crew container. ECS uses it for
   * placement; a crew may burst above it when the host has spare RAM, so idle
   * crews cost little.
   *
   * @default 1024
   */
  readonly crewMemoryReservationMiB?: number;

  /**
   * HARD memory cap (MiB) per crew container. A crew is OOM-killed at this
   * ceiling, so no single crew can consume the whole host. Set the SUM of hard
   * caps at or below (physical RAM minus host + ECS-agent headroom) for a hard
   * cross-crew guarantee — see the host-OOM caution in the README.
   *
   * @default 2048
   */
  readonly crewMemoryHardLimitMiB?: number;

  /**
   * Optional SOFT CPU shares per crew container (1024 = one vCPU). Omit to
   * leave CPU unconstrained (crews share the host CPU fairly under contention).
   *
   * @default - unset (shared CPU)
   */
  readonly crewCpuShares?: number;

  /**
   * ARN of the private ECR repository holding the crew image. Leave unset when
   * the image is pulled from a public registry. When set, each per-crew
   * execution role gets a pull grant scoped to this one repository.
   *
   * @default - public registry; no pull grant
   */
  readonly ecrRepositoryArn?: string;

  /**
   * Container image reference for the crew task. When {@link ecrRepositoryArn}
   * is set this is typically the repo URI with a tag; otherwise a public
   * registry reference.
   *
   * @default 'public.ecr.aws/kirocrew/crew:latest'
   */
  readonly crewImage?: string;

  /**
   * Days a crew's task logs are kept. One of the CloudWatch retention values
   * (see {@link FargateCrew}).
   *
   * @default 30
   */
  readonly logRetentionDays?: number;

  /**
   * An S3 backup bucket. When set, each per-crew TASK role is granted write so
   * the running container pushes its own snapshots off-box.
   *
   * @default - no off-box backup
   */
  readonly backupBucket?: ICrewBackupBucket;

  /**
   * Discovery tag value written as `kirocrew:ecs-host`. Must match
   * `[a-zA-Z0-9-]{1,51}`. The cluster is named `kirocrew-crew-<stackTag>`.
   *
   * @default 'kirocrew'
   */
  readonly stackTag?: string;
}

/**
 * One self-provisioned EC2 host running the ECS agent, hosting `crewCount`
 * Kiro Crew instances as ECS-on-EC2 container tasks.
 *
 * The host registers to the {@link FargateCrewBase} cluster and does the NAT
 * for the crew tasks itself, so the tasks stay fully private with no public
 * IPs and no NAT Gateway, fck-nat, VPC endpoints, or ALB. Each task runs in
 * awsvpc mode with its own ENI and private VPC IP; each crew keeps its durable
 * `~/.kiro/crew` state on its own encrypted EBS volume that survives instance
 * replacement.
 *
 * Isolation is container-level (shared kernel), accepted as sufficient:
 * Graviton Nitro protects the box from other AWS tenants, containers cover
 * crew-to-crew separation. See the host-OOM caution: hard per-task memory caps
 * bound each crew's ceiling but a busy crew can still pressure siblings when
 * the sum of actual usage exceeds physical RAM.
 *
 * `crewCount` defaults to 1, identical to the single-crew shape, so a plain
 * instantiation with no new props gains no extra resources.
 */
export class EcsCrewHost extends Construct {
  /** The shared ECS scaffolding (cluster + egress-only task SG). */
  public readonly base: FargateCrewBase;
  /** The size-1 Auto Scaling Group holding the single ECS-registered EC2 host. */
  public readonly autoScalingGroup: autoscaling.AutoScalingGroup;
  /** The capacity provider registering the host with the cluster. */
  public readonly capacityProvider: ecs.AsgCapacityProvider;
  /** The host instance's IAM role (carries the permissions boundary). */
  public readonly role: iam.Role;
  /** The host's SSM-only security group (no inbound). */
  public readonly hostSecurityGroup: ec2.SecurityGroup;
  /** The per-crew scaffolding (roles + log group), one per crew. */
  public readonly crews: FargateCrew[];
  /** The per-crew EC2 services. */
  public readonly services: ecs.Ec2Service[];
  /** The per-crew durable data volumes (device/label/mount metadata). */
  public readonly dataVolumes: CrewDataVolume[];
  /** The discovery tag value written as `kirocrew:ecs-host`. */
  public readonly stackTag: string;
  /** The resolved crew names. */
  public readonly crewNames: string[];

  constructor(scope: Construct, id: string, props: EcsCrewHostProps) {
    super(scope, id);

    const stackTag = props.stackTag ?? DEFAULT_STACK_TAG;
    if (!STACK_TAG_RE.test(stackTag)) {
      throw new Error(`stackTag must match ${STACK_TAG_RE} (got '${stackTag}')`);
    }
    this.stackTag = stackTag;

    const crewCount = props.crewCount ?? DEFAULT_CREW_COUNT;
    if (!Number.isInteger(crewCount) || crewCount < 1 || crewCount > MAX_CREW_COUNT) {
      throw new Error(
        `crewCount must be an integer 1..${MAX_CREW_COUNT} (got ${crewCount}); ` +
          'awsvpc needs (crewCount + 1) ENIs to fit the instance type',
      );
    }

    const crewNames = props.crews ?? defaultCrewNames(crewCount);
    if (crewNames.length !== crewCount) {
      throw new Error(
        `crews must list exactly crewCount (${crewCount}) names (got ${crewNames.length})`,
      );
    }
    for (const crew of crewNames) {
      if (!CREW_RE.test(crew)) {
        throw new Error(
          `crew name must match ${CREW_RE} (got '${crew}'); it derives the ` +
            'log group, roles, and secret namespace',
        );
      }
    }
    if (new Set(crewNames).size !== crewNames.length) {
      throw new Error(`crew names must be unique (got ${crewNames.join(', ')})`);
    }
    this.crewNames = crewNames;

    const arch = props.architecture ?? CrewArchitecture.ARM64;
    const fargateArch =
      arch === CrewArchitecture.ARM64
        ? FargateCpuArchitecture.ARM64
        : FargateCpuArchitecture.X86_64;

    // --- Shared ECS scaffolding: reuse FargateCrewBase for the cluster and the
    // egress-only task security group, so there is one code path for the
    // cluster the tasks register to.
    this.base = new FargateCrewBase(this, 'Base', {
      vpc: props.vpc,
      vpcSubnets: props.taskSubnets,
      cpuArchitecture: fargateArch,
      stackTag,
    });

    // --- Host instance role: SSM core + required boundary, mirroring
    // RemoteCrewInstance. Plus the ECS-agent register/telemetry permissions so
    // this box can join the cluster and run tasks.
    this.role = new iam.Role(this, 'HostRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      permissionsBoundary: iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        'Boundary',
        props.permissionsBoundaryArn,
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // The ECS container-instance role: RegisterContainerInstance, Poll,
        // Submit*, and the ECR/log actions the agent needs. Standard for an
        // ECS-on-EC2 capacity host.
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceforEC2Role',
        ),
      ],
    });

    // --- Host security group: SSM-only, no inbound. Egress open for image
    // pulls, the model endpoint, and forwarding the tasks' NATed traffic.
    this.hostSecurityGroup = new ec2.SecurityGroup(this, 'HostSecurityGroup', {
      vpc: props.vpc,
      description: `KiroCrew ECS host ${stackTag} - SSM-only (no inbound), does NAT for crew tasks`,
      allowAllOutbound: true,
    });

    // --- Arch-aware ECS-optimized Amazon Linux 2023 AMI (the agent is
    // pre-installed), resolved via the public SSM parameter, no hardcoded id.
    const amiHardwareType =
      arch === CrewArchitecture.ARM64
        ? ecs.AmiHardwareType.ARM
        : ecs.AmiHardwareType.STANDARD;
    const machineImage = ecs.EcsOptimizedImage.amazonLinux2023(amiHardwareType);

    const instanceType =
      props.instanceType ??
      (arch === CrewArchitecture.ARM64
        ? new ec2.InstanceType('m7g.2xlarge')
        : new ec2.InstanceType('m7i.2xlarge'));

    // --- Per-crew durable data volumes: one gp3 EBS each, encrypted,
    // deleteOnTermination:false, resolved in the bootstrap by a stable LABEL
    // (never /dev/sdf, which the Nitro NVMe layer renames).
    const volumeType = props.crewDataVolumeType ?? ec2.EbsDeviceVolumeType.GP3;
    const volumeSize = props.crewDataVolumeSizeGb ?? DEFAULT_CREW_VOLUME_GB;
    this.dataVolumes = crewNames.map((crew, i) => ({
      crew,
      // Device letters f.. (sdf, sdg, ...) are attach-time hints; the kernel
      // renames them on Nitro, so the bootstrap ignores them and uses label.
      deviceName: `/dev/sd${String.fromCharCode('f'.charCodeAt(0) + i)}`,
      label: `crew-${crew}`,
      mountPath: `/var/lib/kirocrew/${crew}`,
    }));

    // The ASG uses the autoscaling module's own BlockDevice types (distinct
    // from ec2's). The public crewDataVolumeType prop stays ec2-typed for
    // library consistency; translate it by its shared string value here.
    const asgVolumeType = volumeType as unknown as autoscaling.EbsDeviceVolumeType;
    const rootBlockDevice: autoscaling.BlockDevice = {
      deviceName: '/dev/xvda',
      volume: autoscaling.BlockDeviceVolume.ebs(props.rootVolumeSizeGb ?? DEFAULT_ROOT_VOLUME_GB, {
        volumeType: autoscaling.EbsDeviceVolumeType.GP3,
        encrypted: true,
        deleteOnTermination: true,
      }),
    };
    const crewBlockDevices: autoscaling.BlockDevice[] = this.dataVolumes.map((v) => ({
      deviceName: v.deviceName,
      volume: autoscaling.BlockDeviceVolume.ebs(volumeSize, {
        volumeType: asgVolumeType,
        encrypted: true,
        // The whole point: a crew's memory outlives an instance replacement.
        deleteOnTermination: false,
      }),
    }));

    // --- UserData: a small header the bootstrap body reads (per-crew volume
    // labels + mount paths, ECS cluster name), then the ECS-host bootstrap
    // asset (host NAT + resolve-by-label EBS mount). The AsgCapacityProvider
    // below ALSO appends the ECS-cluster join to this UserData; writing
    // ECS_CLUSTER here is a harmless idempotent belt-and-braces.
    const bootstrapBody = fs.readFileSync(resolveAsset('ecs-host-bootstrap.sh'), 'utf8');
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'ECS_CLUSTER=' + shellQuote(this.base.cluster.clusterName),
      'CREW_COUNT=' + String(crewCount),
      'CREW_VOLUME_LABELS=' + shellQuote(this.dataVolumes.map((v) => v.label).join(' ')),
      'CREW_MOUNT_PATHS=' + shellQuote(this.dataVolumes.map((v) => v.mountPath).join(' ')),
      'export ECS_CLUSTER CREW_COUNT CREW_VOLUME_LABELS CREW_MOUNT_PATHS',
    );
    userData.addCommands(bootstrapBody);

    // --- The single ECS-registered host, as a size-1 Auto Scaling Group behind
    // an AsgCapacityProvider. A size-1 ASG (min=max=desired=1) is still ONE
    // self-provisioned EC2 host and still ECS-on-EC2 (no Fargate); the capacity
    // provider is what registers that capacity with the cluster so the L2
    // Ec2Services below can schedule onto it. IMDSv2 enforced (a
    // prompt-injectable agent must not read role creds via IMDSv1), encrypted
    // gp3 root, plus the per-crew durable data volumes.
    this.autoScalingGroup = new autoscaling.AutoScalingGroup(this, 'HostAsg', {
      vpc: props.vpc,
      vpcSubnets: props.hostSubnets ?? { subnetType: ec2.SubnetType.PUBLIC },
      instanceType,
      machineImage,
      role: this.role,
      securityGroup: this.hostSecurityGroup,
      userData,
      requireImdsv2: true,
      minCapacity: 1,
      maxCapacity: 1,
      desiredCapacity: 1,
      // The host is in the PUBLIC subnet and carries the public IP so it
      // egresses via the IGW and can NAT the tasks. Tasks get none.
      associatePublicIpAddress: true,
      blockDevices: [rootBlockDevice, ...crewBlockDevices],
    });
    Tags.of(this.autoScalingGroup).add('Name', `kirocrew-ecs-host-${stackTag}`);

    // --- Host does the NAT: it must forward packets that are neither from nor
    // to its own address, which requires source/dest check DISABLED on the host
    // ENI. CloudFormation cannot set SourceDestCheck on an ASG-launched instance
    // declaratively, so the bootstrap disables it on the host itself via
    // ec2:ModifyInstanceAttribute (scoped by an instance-tag condition so the
    // host can only ever modify a KiroCrew ECS host, not an arbitrary instance).
    // The bootstrap also sets ip_forward=1 and the iptables MASQUERADE rule.
    this.role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ec2:ModifyInstanceAttribute'],
        resources: ['*'],
        conditions: {
          StringEquals: { 'aws:ResourceTag/kirocrew:ecs-host': stackTag },
        },
      }),
    );

    // --- Register this ASG's capacity with the cluster. This is what makes the
    // cluster have Ec2 capacity as far as CDK's Ec2Service validation is
    // concerned, and it appends the ECS-cluster join to the host UserData.
    this.capacityProvider = new ecs.AsgCapacityProvider(this, 'HostCapacity', {
      autoScalingGroup: this.autoScalingGroup,
      // The instances are long-lived crew hosts; do not let ECS scale them in
      // or terminate them from under running crews.
      enableManagedTerminationProtection: false,
    });
    this.base.cluster.addAsgCapacityProvider(this.capacityProvider);

    // --- Per-crew: FargateCrew scaffolding (roles + log group), an EC2 task
    // definition (awsvpc), a container definition, and an Ec2Service.
    this.crews = [];
    this.services = [];
    const crewImage = props.crewImage ?? 'public.ecr.aws/kirocrew/crew:latest';
    const memoryReservationMiB =
      props.crewMemoryReservationMiB ?? DEFAULT_MEMORY_RESERVATION_MIB;
    const memoryHardLimitMiB =
      props.crewMemoryHardLimitMiB ?? DEFAULT_MEMORY_HARD_LIMIT_MIB;
    if (memoryReservationMiB > memoryHardLimitMiB) {
      throw new Error(
        `crewMemoryReservationMiB (${memoryReservationMiB}) must not exceed ` +
          `crewMemoryHardLimitMiB (${memoryHardLimitMiB}): the soft reservation ` +
          'cannot be higher than the hard ceiling',
      );
    }

    crewNames.forEach((crew, i) => {
      const dataVolume = this.dataVolumes[i];
      const crewScaffold = new FargateCrew(this, `Crew${i}`, {
        crew,
        logRetentionDays: props.logRetentionDays,
        permissionsBoundaryArn: props.crewPermissionsBoundaryArn,
        ecrRepositoryArn: props.ecrRepositoryArn,
        backupBucket: props.backupBucket,
      });
      this.crews.push(crewScaffold);

      const taskDef = new ecs.Ec2TaskDefinition(this, `TaskDef${i}`, {
        // awsvpc: each task gets its own ENI + private VPC IP.
        networkMode: ecs.NetworkMode.AWS_VPC,
        taskRole: crewScaffold.taskRole,
        executionRole: crewScaffold.executionRole,
        // No runtimePlatform: an EC2 task's architecture is that of the host it
        // lands on (the arm64 ECS-optimized AMI here), not a task-def field
        // (that is Fargate-only).
        // A host volume mapping the crew's mounted EBS path so ~/.kiro/crew is
        // durable across task/instance replacement.
        volumes: [
          {
            name: `crew-data-${crew}`,
            host: { sourcePath: dataVolume.mountPath },
          },
        ],
      });

      const container = taskDef.addContainer(`Crew${i}Container`, {
        image: ecs.ContainerImage.fromRegistry(crewImage),
        // SOFT reservation for scheduling; idle crews cost little.
        memoryReservationMiB,
        // HARD cap so a runaway crew cannot exceed its ceiling (host-OOM
        // blast-radius caution in the README).
        memoryLimitMiB: memoryHardLimitMiB,
        // Optional soft CPU shares; unset => shared CPU under contention.
        cpu: props.crewCpuShares,
        logging: ecs.LogDriver.awsLogs({
          streamPrefix: crew,
          logGroup: crewScaffold.logGroup,
        }),
      });
      container.addMountPoints({
        containerPath: '/home/kirocrew/.kiro/crew',
        sourceVolume: `crew-data-${crew}`,
        readOnly: false,
      });

      const service = new ecs.Ec2Service(this, `Service${i}`, {
        cluster: this.base.cluster,
        taskDefinition: taskDef,
        desiredCount: 1,
        // awsvpc placement: the PRIVATE task subnet, the egress-only task SG,
        // no public IP (tasks are fully private; the host NATs their egress).
        securityGroups: [this.base.securityGroup],
        vpcSubnets: props.taskSubnets ?? {
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      });
      // The service depends on the host capacity being registered.
      service.node.addDependency(this.capacityProvider);
      this.services.push(service);
    });

    // Tag the ASG (tags propagate to launched instances by default), so the
    // kirocrew:ecs-host tag the ModifyInstanceAttribute condition keys off is
    // present on the host, and the SG.
    for (const taggable of [this.autoScalingGroup, this.hostSecurityGroup]) {
      Tags.of(taggable).add('kirocrew:managed', 'true');
      Tags.of(taggable).add('kirocrew:ecs-host', stackTag);
    }
  }

  /** The region the host runs in (read from the stack env, never a prop). */
  public get region(): string {
    return Stack.of(this).region;
  }
}

/** Generate default crew names crew-1 .. crew-<count>. */
function defaultCrewNames(count: number): string[] {
  const names: string[] = [];
  for (let i = 1; i <= count; i++) {
    names.push(`crew-${i}`);
  }
  return names;
}

/** Single-quote a literal for safe embedding; pass CDK tokens through. */
function shellQuote(value: string): string {
  if (Token.isUnresolved(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Resolve a bundled asset by name. Works whether the module runs from `src/`
 * (ts-jest during tests, `__dirname` = src) or `lib/` (a consumer's compiled
 * install, `__dirname` = lib): the asset ships under `src/assets`, so walk up
 * to the package root and read it there. Reading from `lib/assets` would fail
 * for consumers because jsii/tsc does not copy non-TS files into `lib`.
 */
function resolveAsset(name: string): string {
  const candidates = [
    path.join(__dirname, 'assets', name),
    path.join(__dirname, '..', 'src', 'assets', name),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `bundled asset '${name}' not found (looked in: ${candidates.join(', ')})`,
  );
}
