import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rolesanywhere from 'aws-cdk-lib/aws-rolesanywhere';
import { Construct } from 'constructs';

/**
 * Properties for {@link CrewRolesAnywhereRole}.
 */
export interface CrewRolesAnywhereRoleProps {
  /**
   * ARN of a PRE-EXISTING IAM Roles Anywhere trust anchor, created out of band
   * (see 55minutes `docs/onboard-repo-to-crew.md`, the one-time CA + trust
   * anchor bootstrap). The anchor registers the CA whose certificates may
   * request credentials; this construct only CONSUMES it.
   *
   * It is a required prop and is NEVER hardcoded in the construct — the real
   * ARN is supplied at instantiation in the crew (55minutes) stack. The trust
   * anchor, the profile this construct creates, and the role it creates must
   * all live in the SAME account (Roles Anywhere is a same-account service),
   * which is why both the anchor and this construct belong in the crew account.
   */
  readonly trustAnchorArn: string;

  /**
   * The Common Name (CN) of the crew machine's client certificate, e.g.
   * `crew-functional-self`. This PINS the role to one machine: Roles Anywhere
   * surfaces the certificate subject as the session tag
   * `aws:PrincipalTag/x509Subject/CN`, and the role trust policy conditions on
   * it, so only a certificate carrying this CN (issued under the trust anchor's
   * CA) may assume the role.
   */
  readonly certCn: string;

  /**
   * Project slug, e.g. `functional-self`. Drives BOTH well-known routing-contract
   * values this role needs, derived from the same patterns the companion
   * constructs use so the two sides cannot drift:
   *
   * - the command-queue name `crew-commands-<projectSlug>` (see
   *   {@link CrewCommandQueue}), and
   * - the whistle topic `crew/<projectSlug>/wake` (see {@link CrewWakeHub}).
   *
   * The queue ARN is DERIVED from this slug plus {@link projectAccountId} and
   * {@link projectRegion}, never imported — that is what breaks the apparent
   * circular dependency between the role (which must scope its SQS policy to the
   * queue) and the queue (which must grant this role). Both sides reference the
   * other only by a value computed from the well-known name, not by a
   * CloudFormation resource reference.
   */
  readonly projectSlug: string;

  /**
   * Account id of the PROJECT account where the {@link CrewCommandQueue} lives
   * (e.g. functional-self's deploy account). Used only to construct the queue
   * ARN string this role is granted `sqs:*` on — the queue is cross-account and
   * is never referenced as a resource.
   */
  readonly projectAccountId: string;

  /**
   * Region the project's command queue lives in. Used only to construct the
   * queue ARN string.
   *
   * @default - this stack's region
   */
  readonly projectRegion?: string;

  /**
   * Override the whistle topic the role may subscribe to.
   *
   * @default `crew/<projectSlug>/wake`
   */
  readonly wakeTopic?: string;

  /**
   * Create a Roles Anywhere profile scoped to this role, so the crew can name a
   * profile ARN when it requests credentials. Set false if a shared profile is
   * managed elsewhere.
   *
   * @default true
   */
  readonly createProfile?: boolean;
}

/**
 * The crew's single AWS IDENTITY in the whistle/bone trigger model: one IAM
 * role, assumed off-cloud via IAM Roles Anywhere (an X.509 client certificate
 * exchanged for temporary SigV4 credentials), carrying BOTH halves of what a
 * crew needs:
 *
 * - **Hear the whistle** — `iot:Connect` / `iot:Subscribe` / `iot:Receive` on
 *   the project's `crew/<projectSlug>/wake` topic, connected over
 *   MQTT-over-WebSocket signed with SigV4 (NOT the X.509-cert/IoT-policy path),
 *   so the same Roles Anywhere credentials authenticate the IoT connection.
 * - **Drain the bone** — `sqs:ReceiveMessage` / `DeleteMessage` /
 *   `ChangeMessageVisibility` / `GetQueueAttributes` / `GetQueueUrl` on the
 *   project's {@link CrewCommandQueue}, CROSS-ACCOUNT (the queue lives in the
 *   project account; its resource policy must also list this role's ARN as a
 *   `consumerPrincipalArn`).
 *
 * This construct is instantiated in the CREW (55minutes) account, because IoT
 * topic subscription is same-account only and the whistle topic lives there.
 * SQS is the leg that crosses the account boundary instead, which it can via the
 * queue resource policy.
 *
 * The {@link CrewRolesAnywhereRoleProps.trustAnchorArn} is a required,
 * never-hardcoded prop supplied at instantiation. The role's trust policy pins
 * to {@link CrewRolesAnywhereRoleProps.certCn} AND to the trust anchor
 * (`aws:SourceArn`), so a same-CN certificate from any other anchor cannot
 * assume it.
 */
export class CrewRolesAnywhereRole extends Construct {
  /** The IAM role the crew assumes via Roles Anywhere. */
  public readonly role: iam.Role;
  /** The Roles Anywhere profile scoped to the role, when `createProfile` is true. */
  public readonly profile?: rolesanywhere.CfnProfile;
  /** The whistle topic this role may subscribe to. */
  public readonly wakeTopic: string;
  /** The derived (never imported) ARN of the project's command queue. */
  public readonly commandQueueArn: string;

  constructor(scope: Construct, id: string, props: CrewRolesAnywhereRoleProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const region = props.projectRegion ?? stack.region;
    this.wakeTopic = props.wakeTopic ?? `crew/${props.projectSlug}/wake`;

    // DERIVE the queue ARN from the well-known name — never import the queue.
    // This is the seam that breaks the role<->queue circular dependency: both
    // sides reference the other only by a value computed from the deterministic
    // `crew-commands-<slug>` contract name, not by a resource reference.
    this.commandQueueArn = `arn:aws:sqs:${region}:${props.projectAccountId}:crew-commands-${props.projectSlug}`;

    // The role is assumed by the Roles Anywhere service AFTER it has validated
    // the presented certificate against the trust anchor. The trust policy pins
    // to this machine's cert CN and to the specific anchor, so only the intended
    // certificate — issued under our CA — can assume it.
    this.role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('rolesanywhere.amazonaws.com'),
      description: `Crew identity for ${props.projectSlug}: drain its command queue (cross-account) and subscribe to its whistle topic.`,
    });

    const cfnRole = this.role.node.defaultChild as iam.CfnRole;
    cfnRole.assumeRolePolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'rolesanywhere.amazonaws.com' },
          Action: ['sts:AssumeRole', 'sts:TagSession', 'sts:SetSourceIdentity'],
          Condition: {
            StringEquals: {
              'aws:PrincipalTag/x509Subject/CN': props.certCn,
            },
            ArnEquals: {
              'aws:SourceArn': props.trustAnchorArn,
            },
          },
        },
      ],
    };

    // Drain the bone — cross-account SQS on the derived queue ARN. The queue's
    // own resource policy must also list this role (consumerPrincipalArns); both
    // sides are required for cross-account SQS.
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'DrainBone',
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:ChangeMessageVisibility',
          'sqs:GetQueueAttributes',
          'sqs:GetQueueUrl',
        ],
        resources: [this.commandQueueArn],
      }),
    );

    // Hear the whistle — IoT over MQTT-WebSocket (SigV4). Scoped to this
    // project's topic only; isolation between projects is by this topic-scoping.
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'HearWhistleConnect',
        effect: iam.Effect.ALLOW,
        actions: ['iot:Connect'],
        resources: [`arn:aws:iot:${stack.region}:${stack.account}:client/${props.certCn}`],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'HearWhistleSubscribe',
        effect: iam.Effect.ALLOW,
        actions: ['iot:Subscribe'],
        resources: [`arn:aws:iot:${stack.region}:${stack.account}:topicfilter/${this.wakeTopic}`],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'HearWhistleReceive',
        effect: iam.Effect.ALLOW,
        actions: ['iot:Receive'],
        resources: [`arn:aws:iot:${stack.region}:${stack.account}:topic/${this.wakeTopic}`],
      }),
    );

    if (props.createProfile ?? true) {
      this.profile = new rolesanywhere.CfnProfile(this, 'Profile', {
        name: `crew-${props.projectSlug}`,
        roleArns: [this.role.roleArn],
        enabled: true,
      });
    }
  }
}
