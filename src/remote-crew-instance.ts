import * as fs from 'fs';
import * as path from 'path';
import {
  CfnWaitCondition,
  CfnWaitConditionHandle,
  Tags,
  Token,
} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import {
  CrewArchitecture,
  RemoteCrewInstanceProps,
} from './remote-crew-instance-props';

const STACK_TAG_RE = /^[a-zA-Z0-9-]{1,51}$/;
const CIDR_RE =
  /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])\/(3[0-2]|2[0-9]|1[6-9])$/;

const DEFAULT_REPO = 'https://github.com/kirodotdev/KiroCrew.git';
const DEFAULT_REF = 'main';
const DEFAULT_PORT = 5476;
const DEFAULT_STACK_TAG = 'kirocrew';
const DEFAULT_VOLUME_GB = 60;
const DEFAULT_TIMEOUT_MIN = 25;

/**
 * A self-hosted KiroCrew gateway on a single EC2 instance, reached over SSM
 * Session Manager with no inbound ports.
 *
 * This is a pipeline-native, version-controlled CDK port of the upstream
 * `kirocrew-ec2` CloudFormation template
 * (github.com/kirodotdev/KiroCrew). It provisions the same shape — an IAM
 * role (SSM core + optional scoped S3 read) under a required permissions
 * boundary, an SSM-only security group, an IMDSv2-enforced instance on an
 * encrypted gp3 volume, and a WaitCondition that blocks stack completion
 * until the gateway is serving — but under your naming, boundary, and
 * deploy pipeline instead of an imperative `kirocrew cloud launch`.
 *
 * Access is via SSM port-forward only; the public DNS output is for
 * diagnostics.
 */
export class RemoteCrewInstance extends Construct {
  /** The EC2 instance (SSM target). */
  public readonly instance: ec2.Instance;
  /** The instance's IAM role (carries the permissions boundary). */
  public readonly role: iam.Role;
  /** The SSM-only security group (no inbound unless allowSshCidr is set). */
  public readonly securityGroup: ec2.SecurityGroup;
  /** The discovery tag value written as `kirocrew:instance`. */
  public readonly stackTag: string;

  constructor(scope: Construct, id: string, props: RemoteCrewInstanceProps) {
    super(scope, id);

    const stackTag = props.stackTag ?? DEFAULT_STACK_TAG;
    if (!STACK_TAG_RE.test(stackTag)) {
      throw new Error(
        `stackTag must match ${STACK_TAG_RE} (got '${stackTag}')`,
      );
    }
    if (props.allowSshCidr && !CIDR_RE.test(props.allowSshCidr)) {
      throw new Error(
        `allowSshCidr must be a CIDR no wider than /16 (got '${props.allowSshCidr}')`,
      );
    }

    const arch = props.architecture ?? CrewArchitecture.ARM64;
    const source = props.source ?? {};
    if (source.sourceBucket && !source.sourceKey) {
      throw new Error('source.sourceKey is required when source.sourceBucket is set');
    }
    const dashboardPort = props.dashboardPort ?? DEFAULT_PORT;
    this.stackTag = stackTag;

    // --- IAM role: SSM core managed policy + required permissions boundary.
    // The only extra grant is a scoped s3:GetObject when an S3 source is used.
    this.role = new iam.Role(this, 'InstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      permissionsBoundary: iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        'Boundary',
        props.permissionsBoundaryArn,
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    if (source.sourceBucket) {
      this.role.addToPolicy(
        new iam.PolicyStatement({
          actions: ['s3:GetObject'],
          resources: [`arn:aws:s3:::${source.sourceBucket}/${source.sourceKey}`],
        }),
      );
    }

    // --- Security group: SSM-only. No inbound by default; egress open for
    // package install + LLM backend reach.
    this.securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      description: `KiroCrew ${stackTag} - SSM-only (no inbound by default)`,
      allowAllOutbound: true,
    });
    if (props.allowSshCidr) {
      this.securityGroup.addIngressRule(
        ec2.Peer.ipv4(props.allowSshCidr),
        ec2.Port.tcp(22),
        'SSH fallback from the user\'s CIDR',
      );
    }

    // --- Arch-aware Amazon Linux 2023 AMI, resolved at deploy time via the
    // public SSM parameter (matches upstream, no hardcoded AMI id).
    const cpuType =
      arch === CrewArchitecture.ARM64
        ? ec2.AmazonLinuxCpuType.ARM_64
        : ec2.AmazonLinuxCpuType.X86_64;
    const machineImage = ec2.MachineImage.latestAmazonLinux2023({ cpuType });

    const instanceType =
      props.instanceType ??
      (arch === CrewArchitecture.ARM64
        ? new ec2.InstanceType('m7g.2xlarge')
        : new ec2.InstanceType('m7i.2xlarge'));

    // --- WaitCondition: block stack completion until the gateway serves.
    const waitHandle = new CfnWaitConditionHandle(this, 'WaitHandle');

    // --- UserData: a small header injecting the params the bootstrap body
    // reads, then the faithful bootstrap script asset.
    const bootstrapBody = fs.readFileSync(resolveAsset('bootstrap.sh'), 'utf8');
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'WAIT_HANDLE=' + shellQuote(waitHandle.ref),
      'DASHBOARD_PORT=' + String(dashboardPort),
      'SOURCE_BUCKET=' + shellQuote(source.sourceBucket ?? ''),
      'SOURCE_KEY=' + shellQuote(source.sourceKey ?? ''),
      'KIROCREW_REPO=' + shellQuote(source.kirocrewRepo ?? DEFAULT_REPO),
      'KIROCREW_REF=' + shellQuote(source.kirocrewRef ?? DEFAULT_REF),
      'export WAIT_HANDLE DASHBOARD_PORT SOURCE_BUCKET SOURCE_KEY KIROCREW_REPO KIROCREW_REF',
      bootstrapBody,
    );

    // --- The instance. IMDSv2 enforced (prompt-injectable agent must not be
    // able to read role creds via IMDSv1), encrypted gp3 root.
    this.instance = new ec2.Instance(this, 'Instance', {
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets ?? { subnetType: ec2.SubnetType.PUBLIC },
      instanceType,
      machineImage,
      role: this.role,
      securityGroup: this.securityGroup,
      userData,
      requireImdsv2: true,
      associatePublicIpAddress: props.associatePublicIp ?? true,
      blockDevices: [
        {
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(props.volumeSizeGb ?? DEFAULT_VOLUME_GB, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
            deleteOnTermination: true,
          }),
        },
      ],
    });
    Tags.of(this.instance).add('Name', `kirocrew-${stackTag}`);

    // Discovery tags on the instance and SG (matches the registry contract).
    for (const taggable of [this.instance, this.securityGroup]) {
      Tags.of(taggable).add('kirocrew:managed', 'true');
      Tags.of(taggable).add('kirocrew:instance', stackTag);
    }

    const timeoutSecs =
      (props.bootstrapTimeoutMinutes ?? DEFAULT_TIMEOUT_MIN) * 60;
    const waitCondition = new CfnWaitCondition(this, 'WaitCondition', {
      handle: waitHandle.ref,
      timeout: String(timeoutSecs),
      count: 1,
    });
    waitCondition.addDependency(
      this.instance.node.defaultChild as ec2.CfnInstance,
    );
  }

  /** Public DNS of the instance (diagnostics only; access is via SSM). */
  public get publicDnsName(): string {
    return this.instance.instancePublicDnsName;
  }

  /** Instance id — the SSM target. */
  public get instanceId(): string {
    return this.instance.instanceId;
  }
}

/** Single-quote a literal for safe embedding; pass CDK tokens through. */
function shellQuote(value: string): string {
  // An unresolved CDK token (e.g. the WaitHandle ref) must reach CloudFormation
  // intact — UserData interpolation resolves it. Only literals are quoted.
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
    path.join(__dirname, 'assets', name), // running from src/ (tests)
    path.join(__dirname, '..', 'src', 'assets', name), // running from lib/ (consumers)
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