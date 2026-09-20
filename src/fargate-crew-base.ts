import { Tags } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

const STACK_TAG_RE = /^[a-zA-Z0-9-]{1,51}$/;

/**
 * CPU architecture a crew container image was built for. Must match the image:
 * a task whose runtime platform disagrees with its image fails at start.
 */
export enum FargateCpuArchitecture {
  X86_64 = 'X86_64',
  ARM64 = 'ARM64',
}

/**
 * Properties for {@link FargateCrewBase}.
 */
export interface FargateCrewBaseProps {
  /**
   * VPC the crew tasks are placed in.
   */
  readonly vpc: ec2.IVpc;

  /**
   * Subnets for the tasks' awsvpc network interfaces. Each must be able to
   * reach the container registry — a NAT-routed private subnet, or a public
   * subnet with `assignPublicIp` at RunTask.
   *
   * Networking is taken, never invented: whether egress is via NAT or a public
   * subnet is a property of the operator's VPC this construct cannot discover,
   * so it is passed in and echoed as an output for the launch spec.
   *
   * @default - the VPC's private-with-egress subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * Architecture the crew image was built for. Surfaced as an output for the
   * launch spec so every placement field is read from a stack, not the
   * operator's memory.
   *
   * @default FargateCpuArchitecture.X86_64
   */
  readonly cpuArchitecture?: FargateCpuArchitecture;

  /**
   * Discovery tag value written as `kirocrew:fargate`. Must match
   * `[a-zA-Z0-9-]{1,51}`. The cluster is named `kirocrew-crew-<stackTag>`.
   *
   * @default 'kirocrew'
   */
  readonly stackTag?: string;
}

/**
 * Shared Fargate scaffolding for KiroCrew remote crews: the ECS cluster every
 * crew task runs on and the egress-only security group they are placed in.
 *
 * ONE per account and region. The per-crew roles and log group live in
 * {@link FargateCrew} (one per crew), so deleting a crew cannot delete the
 * cluster its siblings run on.
 *
 * Port of the upstream `kirocrew-fargate-base` CloudFormation template.
 */
export class FargateCrewBase extends Construct {
  /** The ECS cluster crew tasks run on. */
  public readonly cluster: ecs.Cluster;
  /** The egress-only task security group (no inbound). */
  public readonly securityGroup: ec2.SecurityGroup;
  /** The `kirocrew:fargate` discovery tag value. */
  public readonly stackTag: string;
  /** The architecture crew images must be built for. */
  public readonly cpuArchitecture: FargateCpuArchitecture;

  constructor(scope: Construct, id: string, props: FargateCrewBaseProps) {
    super(scope, id);

    const stackTag = props.stackTag ?? 'kirocrew';
    if (!STACK_TAG_RE.test(stackTag)) {
      throw new Error(`stackTag must match ${STACK_TAG_RE} (got '${stackTag}')`);
    }
    this.stackTag = stackTag;
    this.cpuArchitecture = props.cpuArchitecture ?? FargateCpuArchitecture.X86_64;

    // Named from the tag (not discovered) so a launcher can derive it, and to
    // keep tasks out of the account's implicit `default` cluster.
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `kirocrew-crew-${stackTag}`,
      containerInsightsV2: ecs.ContainerInsights.DISABLED,
    });

    // No ingress at all. The crew's control surface is reached
    // outbound-authenticated; nothing needs to dial in. Egress open so the
    // task can pull its image and reach the model endpoint.
    this.securityGroup = new ec2.SecurityGroup(this, 'TaskSecurityGroup', {
      vpc: props.vpc,
      description: `Kiro Crew Fargate crews ${stackTag} - egress only, no inbound`,
      allowAllOutbound: true,
    });

    for (const taggable of [this.cluster, this.securityGroup]) {
      Tags.of(taggable).add('kirocrew:managed', 'true');
      Tags.of(taggable).add('kirocrew:fargate', stackTag);
    }
  }
}
