import { Duration } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { EcsCrewHost } from './ecs-crew-host';

const DEFAULT_CREW_PORT = 5476;

/**
 * Properties for {@link CrewWebhookIngress}.
 */
export interface CrewWebhookIngressProps {
  /**
   * VPC to place the ingress Lambda in. Must be the same VPC as the crew tasks
   * so the Lambda can reach a task's private ENI IP directly with NO VPC
   * endpoint.
   */
  readonly vpc: ec2.IVpc;

  /**
   * The crew host whose tasks receive webhooks. The task security group is
   * granted a scoped inbound rule from this ingress Lambda's SG on the crew
   * port only — the one controlled inbound exception to the egress-only model.
   */
  readonly host: EcsCrewHost;

  /**
   * ARN of an IAM permissions boundary applied to the Lambda's execution role.
   * The ingress Lambda runs consumer-triggered code, so it carries a boundary
   * matching the rest of the construct.
   */
  readonly permissionsBoundaryArn: string;

  /**
   * The code the ingress Lambda runs. The consumer supplies it: this construct
   * wires the plumbing (SNS -> in-VPC Lambda -> task private IP) but does not
   * ship an opinion about how a webhook payload maps to a crew.
   */
  readonly code: lambda.Code;

  /**
   * The Lambda handler entry point.
   *
   * @default 'index.handler'
   */
  readonly handler?: string;

  /**
   * The Lambda runtime. Must be an arm64-compatible runtime to match the
   * arm64 default host.
   *
   * @default lambda.Runtime.NODEJS_20_X
   */
  readonly runtime?: lambda.Runtime;

  /**
   * Lambda architecture. Defaults to arm64 to match the Graviton host.
   *
   * @default lambda.Architecture.ARM_64
   */
  readonly architecture?: lambda.Architecture;

  /**
   * Subnets to place the ingress Lambda's ENIs in. Should be the same private
   * subnet the crew tasks run in so the Lambda reaches task IPs directly.
   *
   * @default - the VPC's private-with-egress subnets
   */
  readonly vpcSubnets?: ec2.SubnetSelection;

  /**
   * TCP port on the crew task the Lambda reaches (the gateway/webhook port).
   *
   * @default 5476
   */
  readonly crewPort?: number;

  /**
   * An existing SNS topic to subscribe the Lambda to. Omit to create one.
   *
   * @default - a new topic is created
   */
  readonly topic?: sns.ITopic;

  /**
   * Lambda timeout.
   *
   * @default Duration.seconds(30)
   */
  readonly timeout?: Duration;
}

/**
 * OPTIONAL, composable webhook-ingress path for {@link EcsCrewHost}, mirroring
 * the optional {@link CrewBackupBucket} shape. Nothing is created unless the
 * consumer instantiates it, so an existing consumer gains no new resources.
 *
 * Because each crew task runs in awsvpc mode with a real private VPC IP, an
 * in-VPC Lambda can POST to a crew's `POST /api/hooks/agent` DIRECTLY — no VPC
 * endpoint, no PrivateLink, no ALB. This construct wires: an SNS topic, an
 * in-VPC Lambda under the permissions boundary, and a scoped ingress rule on
 * the crew task security group from the Lambda's SG on the crew port ONLY.
 * That ingress rule is the single controlled inbound exception to the
 * egress-only task model.
 *
 * Greenfield: the construct wires the plumbing but ships no webhook-to-crew
 * routing opinion — the consumer supplies the Lambda {@link CrewWebhookIngressProps.code}.
 */
export class CrewWebhookIngress extends Construct {
  /** The SNS topic that fans events into the ingress Lambda. */
  public readonly topic: sns.ITopic;
  /** The in-VPC ingress Lambda. */
  public readonly function: lambda.Function;
  /** The ingress Lambda's security group (the source of the scoped task ingress rule). */
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: CrewWebhookIngressProps) {
    super(scope, id);

    const crewPort = props.crewPort ?? DEFAULT_CREW_PORT;

    this.securityGroup = new ec2.SecurityGroup(this, 'IngressLambdaSg', {
      vpc: props.vpc,
      description: 'KiroCrew webhook-ingress Lambda - reaches crew task private IPs',
      allowAllOutbound: true,
    });

    const executionRole = new iam.Role(this, 'IngressLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      permissionsBoundary: iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        'Boundary',
        props.permissionsBoundaryArn,
      ),
      managedPolicies: [
        // The Lambda runs in a VPC, so it needs the ENI-management actions.
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaVPCAccessExecutionRole',
        ),
      ],
    });

    this.function = new lambda.Function(this, 'IngressLambda', {
      runtime: props.runtime ?? lambda.Runtime.NODEJS_20_X,
      architecture: props.architecture ?? lambda.Architecture.ARM_64,
      handler: props.handler ?? 'index.handler',
      code: props.code,
      role: executionRole,
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets ?? {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.securityGroup],
      timeout: props.timeout ?? Duration.seconds(30),
      environment: {
        CREW_PORT: String(crewPort),
      },
    });

    this.topic = props.topic ?? new sns.Topic(this, 'IngressTopic');
    this.topic.addSubscription(new subs.LambdaSubscription(this.function));

    // The one controlled inbound exception to the egress-only task model: the
    // crew task SG accepts the crew port FROM the ingress Lambda SG only, never
    // a CIDR. Documented in the README.
    props.host.base.securityGroup.addIngressRule(
      ec2.Peer.securityGroupId(this.securityGroup.securityGroupId),
      ec2.Port.tcp(crewPort),
      'Webhook ingress from the in-VPC ingress Lambda SG only (no CIDR)',
    );
  }
}
