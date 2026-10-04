import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

/**
 * Properties for {@link CrewCommandQueue}.
 */
export interface CrewCommandQueueProps {
  /**
   * Project slug, e.g. `functional-self`. Drives the deterministic queue name
   * `crew-commands-<projectSlug>` (and `-dlq`).
   *
   * The name is deterministic BY DESIGN: it is the cross-origin routing
   * contract that the wake hub's EventBridge target sends to and that the crew
   * poller drains. It is not an AWS-assigned physical id being pinned (which
   * the project forbids) — it is a stable contract value, the same way an API
   * path or a topic name is chosen, not generated.
   */
  readonly projectSlug: string;

  /**
   * ARN of the principal in the 55minutes wake-hub account that delivers bones
   * onto this queue — the EventBridge rule's target role (or the pipe/role that
   * performs the cross-account `SendMessage`). Granted `sqs:SendMessage` on this
   * queue via the queue resource policy. This is the SEND side of the queue.
   */
  readonly senderRoleArn: string;

  /**
   * ARNs of the crew principals allowed to DRAIN this queue (the dogs that
   * fetch the bone), wherever they run — an EC2 instance role, an assumed role,
   * or an on-prem IAM user. Each is granted `sqs:ReceiveMessage`,
   * `sqs:DeleteMessage` and `sqs:GetQueueAttributes` via the queue resource
   * policy. This is the RECEIVE side, and it is a list because the design
   * permits several crews to compete on one project's queue (failover or
   * load-sharing); SQS hands each bone to exactly one of them.
   *
   * At least one ARN is required — a queue nothing may drain is a mistake, not
   * a valid state.
   */
  readonly consumerPrincipalArns: string[];

  /**
   * Redrive threshold: deliveries attempted before a bone is moved to the DLQ.
   * A crew that keeps dying mid-work on one message must not spin on it forever.
   *
   * @default 5
   */
  readonly maxReceiveCount?: number;

  /**
   * How long a bone is held in the queue before expiry if never claimed. The
   * durability window: a whistle missed while every crew was disconnected is
   * recovered as long as the bone is still within retention.
   *
   * @default Duration.days(4)
   */
  readonly retention?: Duration;

  /**
   * Visibility timeout: how long a claimed-but-unacked bone stays hidden from
   * other crews before reappearing. Must exceed the longest a crew takes to
   * process one bone and `DeleteMessage`, or two crews can end up working the
   * same item. The wake model only needs the hand-off window (fetch + POST to
   * the local hook + delete), not the whole downstream job.
   *
   * @default Duration.seconds(60)
   */
  readonly visibilityTimeout?: Duration;
}

/**
 * The BONE in the whistle/bone trigger model (see 55minutes ADR 0002): a
 * per-project SQS command queue that holds the actual work item, delivers it to
 * exactly one competing crew, and never loses it.
 *
 * The companion {@link CrewWakeHub} fans a verified GitHub event to two places:
 * an IoT topic (the whistle — a dumb, lossy, fan-out "there's a bone" wake) and
 * this queue (the bone — durable, one-winner). A crew woken by the whistle
 * drains THIS queue to claim the work. The queue does the two things the IoT
 * whistle cannot:
 *
 * - **Mutual exclusion.** A message is delivered to one consumer and hidden for
 *   {@link CrewCommandQueueProps.visibilityTimeout} while it is worked, so when
 *   several crews race on one whistle, exactly one claims the bone.
 * - **Durability.** The message is held until acked (`DeleteMessage`); a crew
 *   that dies mid-work never acks, so the bone reappears and another crew takes
 *   it, and the {@link deadLetterQueue} catches a bone that keeps failing.
 *
 * This construct is instantiated in the PROJECT's own deploy account (the
 * project owns its work pool). Both ends of the queue are cross-account and are
 * authorised by the queue's resource policy, written here from the two props:
 * the wake hub's sender role on the SEND side, the crew principals on the
 * RECEIVE side. Nothing else may touch the queue.
 *
 * It is a sibling to {@link CrewWebhookIngress} (the VPC-push ingress variant),
 * not a replacement: that one pushes to a VPC-resident crew; this one lets a
 * crew that only dials out claim work with no inbound at all.
 */
export class CrewCommandQueue extends Construct {
  /** The command queue — the bone. */
  public readonly queue: sqs.Queue;
  /** The dead-letter queue for bones that exceed the redrive threshold. */
  public readonly deadLetterQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: CrewCommandQueueProps) {
    super(scope, id);

    if (props.consumerPrincipalArns.length === 0) {
      throw new Error(
        'CrewCommandQueue requires at least one consumerPrincipalArn — a queue no crew may drain is never valid.',
      );
    }

    this.deadLetterQueue = new sqs.Queue(this, 'Dlq', {
      queueName: `crew-commands-${props.projectSlug}-dlq`,
      enforceSSL: true,
      // Keep a failed bone long enough to investigate it by hand.
      retentionPeriod: Duration.days(14),
    });

    this.queue = new sqs.Queue(this, 'Queue', {
      queueName: `crew-commands-${props.projectSlug}`,
      enforceSSL: true,
      retentionPeriod: props.retention ?? Duration.days(4),
      visibilityTimeout: props.visibilityTimeout ?? Duration.seconds(60),
      // Long-poll by default so a crew that forgets to pass WaitTimeSeconds
      // still long-polls (20s is the SQS maximum) rather than hot short-polling.
      receiveMessageWaitTime: Duration.seconds(20),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: props.maxReceiveCount ?? 5,
      },
    });

    // SEND side: the wake hub's cross-account sender role may enqueue bones.
    this.queue.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'WakeHubSend',
        effect: iam.Effect.ALLOW,
        principals: [new iam.ArnPrincipal(props.senderRoleArn)],
        actions: ['sqs:SendMessage', 'sqs:GetQueueAttributes', 'sqs:GetQueueUrl'],
        resources: [this.queue.queueArn],
      }),
    );

    // RECEIVE side: each crew principal may drain and ack bones. A list, because
    // several crews may compete on one project's queue; SQS gives each bone to
    // exactly one of them.
    this.queue.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'CrewDrain',
        effect: iam.Effect.ALLOW,
        principals: props.consumerPrincipalArns.map((arn) => new iam.ArnPrincipal(arn)),
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
          'sqs:GetQueueUrl',
          'sqs:ChangeMessageVisibility',
        ],
        resources: [this.queue.queueArn],
      }),
    );
  }

  /**
   * Grant a SAME-ACCOUNT principal permission to drain this queue (identity-side
   * grant). The cross-account crew principals are already allowed by the queue
   * resource policy; use this helper only for a consumer in the queue's own
   * account whose role is defined in the same app.
   */
  public grantConsume(grantee: iam.IGrantable): void {
    this.queue.grantConsumeMessages(grantee);
  }

  /**
   * Grant a SAME-ACCOUNT principal permission to send to this queue. The wake
   * hub's cross-account sender is already allowed by the resource policy; use
   * this only for a same-account producer defined in the same app.
   */
  public grantSend(grantee: iam.IGrantable): void {
    this.queue.grantSendMessages(grantee);
  }
}
