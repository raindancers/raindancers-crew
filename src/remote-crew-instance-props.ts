import * as ec2 from 'aws-cdk-lib/aws-ec2';

/**
 * CPU architecture for the KiroCrew EC2 instance. Selects the matching
 * Amazon Linux 2023 AMI and the pinned Node.js / kiro-cli download.
 */
export enum CrewArchitecture {
  /** 64-bit ARM (Graviton). The upstream default. */
  ARM64 = 'arm64',
  /** 64-bit x86. */
  X86_64 = 'x86_64',
}

/**
 * How the KiroCrew source is delivered to the instance at first boot.
 *
 * Exactly one mode is active. When {@link sourceBucket} is set the instance
 * downloads a source tarball from S3 (and is granted read on just that one
 * object); otherwise it shallow-clones {@link kirocrewRef} from
 * {@link kirocrewRepo}.
 */
export interface CrewSource {
  /**
   * S3 bucket holding the source tarball (`kirocrew-src.tar.gz`). When set,
   * the instance role is granted `s3:GetObject` on this object ONLY. Leave
   * unset to clone from git instead.
   *
   * @default - clone from git (see kirocrewRepo / kirocrewRef)
   */
  readonly sourceBucket?: string;

  /**
   * S3 key of the source tarball within {@link sourceBucket}. Required when
   * `sourceBucket` is set; ignored otherwise.
   *
   * @default - none
   */
  readonly sourceKey?: string;

  /**
   * Git repository to clone when no S3 source is configured.
   *
   * @default 'https://github.com/kirodotdev/KiroCrew.git'
   */
  readonly kirocrewRepo?: string;

  /**
   * Git ref (branch or tag) to install when cloning.
   *
   * Pin this to a released tag for reproducible, version-controlled deploys —
   * the upstream launcher defaults to `main`, which drifts. This construct
   * defaults to `main` only to match upstream; SET IT to a tag in production.
   *
   * @default 'main'
   */
  readonly kirocrewRef?: string;
}

/**
 * Properties for {@link RemoteCrewInstance}.
 */
export interface RemoteCrewInstanceProps {
  /**
   * VPC to launch the instance into.
   */
  readonly vpc: ec2.IVpc;

  /**
   * ARN of an IAM permissions boundary applied to the instance role.
   *
   * The instance runs a prompt-injectable agent that executes arbitrary
   * tools, so its role MUST carry a boundary that caps blast radius. This is
   * required, not optional.
   */
  readonly permissionsBoundaryArn: string;

  /**
   * Subnet selection for the instance. A public (IGW-routed) subnet needs a
   * public IP for egress; a private (NAT-routed) subnet does not — see
   * {@link associatePublicIp}.
   *
   * @default - one public subnet in the VPC
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * EC2 instance type.
   *
   * @default - m7g.2xlarge (arm64) / m7i.2xlarge (x86_64), matching the
   * upstream "Development" size tier
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * CPU architecture. Must match {@link instanceType} when that is set.
   *
   * @default CrewArchitecture.ARM64
   */
  readonly architecture?: CrewArchitecture;

  /**
   * gp3 root volume size in GiB (20–1000). The volume is always encrypted.
   *
   * @default 60
   */
  readonly volumeSizeGb?: number;

  /**
   * Attach a public IP to the instance ENI. Required for egress on IGW-only
   * subnets; leave off (false) for NAT-routed private subnets, where it is
   * unused attack surface.
   *
   * @default true
   */
  readonly associatePublicIp?: boolean;

  /**
   * Discovery tag value written as `kirocrew:instance`. Must match
   * `[a-zA-Z0-9-]{1,51}`.
   *
   * @default 'kirocrew'
   */
  readonly stackTag?: string;

  /**
   * TCP port the gateway serves the dashboard on (loopback only; reached via
   * SSM port-forward). Recorded in the instance registry as the remote port.
   *
   * @default 5476
   */
  readonly dashboardPort?: number;

  /**
   * Optional SSH ingress CIDR. When set (and no wider than /16), opens tcp/22
   * from that CIDR as a fallback. Omit for SSM-only access (recommended).
   *
   * @default - no inbound; SSM-only
   */
  readonly allowSshCidr?: string;

  /**
   * How the KiroCrew source reaches the instance (S3 tarball or git clone).
   *
   * @default - clone kirodotdev/KiroCrew@main
   */
  readonly source?: CrewSource;

  /**
   * Minutes to wait for the gateway to become healthy before the stack fails
   * and rolls back (cold boot + dnf + Node + vite build + pip).
   *
   * @default 25
   */
  readonly bootstrapTimeoutMinutes?: number;
}
