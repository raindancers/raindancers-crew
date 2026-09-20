import { Aws, Tags } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

// Mirrors _CREW_RE in the upstream cloud/fargate/identity.py exactly. A
// trailing hyphen would make the derived role end in "--exec"; a leading one is
// not a legal start for the derived resource names.
const CREW_RE = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;
// Matches the upstream template's PermissionsBoundaryArn AllowedPattern.
const BOUNDARY_RE =
  /^arn:aws(-[a-z0-9]+)*:iam::[0-9]{12}:policy\/kirocrew-crew-boundary$/;
const ECR_REPO_RE =
  /^arn:aws(-[a-z0-9]+)*:ecr:[a-z0-9-]{1,32}:[0-9]{12}:repository\/[a-zA-Z0-9._/-]+$/;

/** CloudWatch Logs retention values the upstream template permits. */
const ALLOWED_RETENTION_DAYS = [1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365];

/**
 * Properties for {@link FargateCrew}.
 */
export interface FargateCrewProps {
  /**
   * Crew name: 1–32 chars, lower-case alphanumeric with inner hyphens, never
   * leading or trailing. Every resource name is DERIVED from it — the task
   * definition rebuilds the role ARNs and log-group name from the crew name
   * and refuses a document whose ARNs disagree, so a rename here is a launch
   * refusal, not a silent mismatch.
   */
  readonly crew: string;

  /**
   * Days a crew's task logs are kept before CloudWatch expires them. Must be
   * one of the CloudWatch retention values.
   *
   * @default 30
   */
  readonly logRetentionDays?: number;

  /**
   * ARN of the pre-created shared crew permissions boundary
   * (`arn:aws:iam::<account>:policy/kirocrew-crew-boundary`).
   *
   * Optional by design: this is a DECLARED degraded mode. Unlike the EC2 lane
   * (whose boundary is created once by launcher code), no creator exists for
   * the crew boundary yet, so rather than reference a policy nothing creates
   * this is omitted until that creator lands. When set, it caps what these
   * roles can ever do regardless of attached policies.
   *
   * @default - no boundary (declared degraded mode)
   */
  readonly permissionsBoundaryArn?: string;

  /**
   * ARN of the private ECR repository holding the crew image. Leave unset when
   * the image is pulled from a public registry (the decided delivery, ECR
   * Public), which needs no execution-role pull grant. When set, the pull grant
   * is scoped to this one repository.
   *
   * @default - public registry; no pull grant
   */
  readonly ecrRepositoryArn?: string;
}

/**
 * Per-crew Fargate scaffolding for ONE KiroCrew remote crew: the two roles a
 * task carries and the log group it writes to.
 *
 * One per crew, alongside the shared {@link FargateCrewBase}. Deleting this
 * removes exactly one crew's identity and logs and leaves the cluster and its
 * siblings untouched. Port of the upstream `kirocrew-fargate-crew` template.
 *
 * Security invariants preserved from upstream:
 * - The **task role** (the running container's identity, and the blast radius
 *   one agent turn reaches) is created with NO policies and MUST NEVER be
 *   granted `secretsmanager:GetSecretValue` — the model credential is already
 *   in the container env, so the grant buys nothing while letting one turn read
 *   every crew's secret.
 * - The **execution role** reads secrets scoped to `kirocrew/crew/<crew>/*`
 *   only, with individually-listed actions (no prefix wildcards).
 * - Both assume-role policies carry an `aws:SourceAccount` condition so the
 *   roles are not assumable on behalf of an unrelated stack's task.
 */
export class FargateCrew extends Construct {
  /** Role ECS assumes BEFORE the container starts (secret fetch + log stream). */
  public readonly executionRole: iam.Role;
  /** Identity the RUNNING container carries. Created with no policies. */
  public readonly taskRole: iam.Role;
  /** The crew's log group (`/kirocrew/crew/<crew>`). */
  public readonly logGroup: logs.LogGroup;
  /** The crew this construct scaffolds. */
  public readonly crew: string;
  /** The one secret ARN pattern the execution role may read. */
  public readonly secretArnPattern: string;

  constructor(scope: Construct, id: string, props: FargateCrewProps) {
    super(scope, id);

    const crew = props.crew;
    if (!CREW_RE.test(crew)) {
      throw new Error(
        'crew must be 1-32 chars, lower-case alphanumeric with inner hyphens ' +
          `(never leading/trailing); got '${crew}'`,
      );
    }
    const retention = props.logRetentionDays ?? 30;
    if (!ALLOWED_RETENTION_DAYS.includes(retention)) {
      throw new Error(
        `logRetentionDays must be one of ${ALLOWED_RETENTION_DAYS.join(', ')}`,
      );
    }
    if (props.permissionsBoundaryArn && !BOUNDARY_RE.test(props.permissionsBoundaryArn)) {
      throw new Error(
        'permissionsBoundaryArn must be a kirocrew-crew-boundary policy ARN',
      );
    }
    if (props.ecrRepositoryArn && !ECR_REPO_RE.test(props.ecrRepositoryArn)) {
      throw new Error('ecrRepositoryArn must be a valid ECR repository ARN');
    }
    this.crew = crew;

    const boundary = props.permissionsBoundaryArn
      ? iam.ManagedPolicy.fromManagedPolicyArn(this, 'Boundary', props.permissionsBoundaryArn)
      : undefined;

    // Log group. Name is FIXED (logConfiguration is one of the four fields
    // RunTask cannot override), derived as /kirocrew/crew/<crew>.
    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/kirocrew/crew/${crew}`,
      retention: retentionToEnum(retention),
    });

    const secretArnPattern = `arn:${Aws.PARTITION}:secretsmanager:${Aws.REGION}:${Aws.ACCOUNT_ID}:secret:kirocrew/crew/${crew}/*`;
    this.secretArnPattern = secretArnPattern;
    const logGroupArn = `arn:${Aws.PARTITION}:logs:${Aws.REGION}:${Aws.ACCOUNT_ID}:log-group:/kirocrew/crew/${crew}:*`;

    const assumedBy = new iam.ServicePrincipal('ecs-tasks.amazonaws.com', {
      conditions: {
        // Without this the role is assumable on behalf of any task in the
        // account, including one an unrelated stack registered.
        StringEquals: { 'aws:SourceAccount': Aws.ACCOUNT_ID },
      },
    });

    // Execution role: what ECS assumes BEFORE the container starts, to fetch
    // secrets and open the log stream. The container never holds this role,
    // which is why the secret read lives here and not on the task role.
    this.executionRole = new iam.Role(this, 'ExecutionRole', {
      roleName: `kirocrew-crew-${crew}-exec`,
      assumedBy,
      permissionsBoundary: boundary,
    });
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        // Scoped to THIS crew's secret namespace. The trailing wildcard covers
        // only the six-char suffix Secrets Manager appends; it does not widen
        // the crew segment, so this role cannot read a sibling's secret.
        actions: ['secretsmanager:GetSecretValue'],
        resources: [secretArnPattern],
      }),
    );
    this.executionRole.addToPolicy(
      new iam.PolicyStatement({
        // CreateLogGroup is absent on purpose: the group is created by this
        // construct, so a task that could create one could write outside the
        // namespace it is retained and deleted under.
        actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
        resources: [logGroupArn],
      }),
    );
    if (props.ecrRepositoryArn) {
      // GetAuthorizationToken is account-wide by the service's own design (it
      // names no repository); the layer/image reads are scoped to the repo.
      this.executionRole.addToPolicy(
        new iam.PolicyStatement({
          actions: ['ecr:GetAuthorizationToken'],
          resources: ['*'],
        }),
      );
      this.executionRole.addToPolicy(
        new iam.PolicyStatement({
          actions: [
            'ecr:BatchCheckLayerAvailability',
            'ecr:BatchGetImage',
            'ecr:GetDownloadUrlForLayer',
          ],
          resources: [props.ecrRepositoryArn],
        }),
      );
    }

    // Task role: the identity the RUNNING container carries. Created with NO
    // policies at all — the intended starting state. It must NEVER be granted
    // secretsmanager:GetSecretValue (see class docstring).
    this.taskRole = new iam.Role(this, 'TaskRole', {
      roleName: `kirocrew-crew-${crew}-task`,
      assumedBy,
      permissionsBoundary: boundary,
    });

    for (const taggable of [this.logGroup, this.executionRole, this.taskRole]) {
      Tags.of(taggable).add('kirocrew:managed', 'true');
      Tags.of(taggable).add('kirocrew:crew', crew);
    }
  }

  /** Namespace a crew secret must be created under for the exec role to read it. */
  public get secretNamePrefix(): string {
    return `kirocrew/crew/${this.crew}/`;
  }
}

function retentionToEnum(days: number): logs.RetentionDays {
  const map: Record<number, logs.RetentionDays> = {
    1: logs.RetentionDays.ONE_DAY,
    3: logs.RetentionDays.THREE_DAYS,
    5: logs.RetentionDays.FIVE_DAYS,
    7: logs.RetentionDays.ONE_WEEK,
    14: logs.RetentionDays.TWO_WEEKS,
    30: logs.RetentionDays.ONE_MONTH,
    60: logs.RetentionDays.TWO_MONTHS,
    90: logs.RetentionDays.THREE_MONTHS,
    120: logs.RetentionDays.FOUR_MONTHS,
    150: logs.RetentionDays.FIVE_MONTHS,
    180: logs.RetentionDays.SIX_MONTHS,
    365: logs.RetentionDays.ONE_YEAR,
  };
  return map[days];
}
