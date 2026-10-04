import { Duration, Lazy, Stack } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigwi from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

/**
 * One project wired onto the wake hub: the GitHub repo whose events become
 * whistles, the IoT topic the whistle is published to, and the cross-account
 * command queue the matching bone is sent to.
 */
export interface CrewWakeHubProject {
  /**
   * Project slug, e.g. `functional-self`. Used as the default IoT topic segment
   * (`crew/<projectSlug>/wake`) and in the generated routing table.
   */
  readonly projectSlug: string;

  /**
   * The full repo name the webhook events carry, e.g.
   * `bwip-holdings/functional-self`. The verifier matches the inbound event's
   * repo against this to route to the right project's whistle and bone.
   */
  readonly repoFullName: string;

  /**
   * ARN of this project's {@link CrewCommandQueue} in the project's OWN deploy
   * account. The verifier sends the bone here cross-account; the queue's
   * resource policy (written by CrewCommandQueue) authorises the verifier role.
   */
  readonly commandQueueArn: string;

  /**
   * IoT topic the whistle is published to.
   *
   * @default `crew/<projectSlug>/wake`
   */
  readonly wakeTopic?: string;
}

/**
 * Properties for {@link CrewWakeHub}.
 */
export interface CrewWakeHubProps {
  /**
   * The code the verifier/router Lambda runs. It does the WHOLE router job:
   *
   * 1. validate the GitHub `X-Hub-Signature-256` HMAC against the shared secret
   *    (read from `GITHUB_WEBHOOK_SECRET_ARN`), reject on mismatch before parsing;
   * 2. filter to the events that are real triggers;
   * 3. look the event's repo up in the routing table (`CREW_ROUTING_TABLE`, a
   *    JSON map of repoFullName -> {topic, queueUrl, queueArn}) and, for a match,
   *    publish the whistle (`iot:Publish` to the topic) AND send the bone
   *    (`sqs:SendMessage` to the queue URL, cross-account).
   *
   * The consumer supplies the code; the construct wires the plumbing (public
   * edge, the scoped IAM for publish + cross-account send, the routing table in
   * the environment) but ships no opinion about payload shape.
   */
  readonly verifierCode: lambda.Code;

  /**
   * ARN of the Secrets Manager secret holding the GitHub webhook HMAC signing
   * secret. The verifier is granted read on exactly this secret and receives
   * its ARN as `GITHUB_WEBHOOK_SECRET_ARN`.
   */
  readonly webhookSecretArn: string;

  /**
   * Projects wired onto the hub. Each adds a routing-table entry, an
   * `iot:Publish` grant on its topic, and a cross-account `sqs:SendMessage`
   * grant on its queue. May be empty at first and grown as projects onboard.
   *
   * @default []
   */
  readonly projects?: CrewWakeHubProject[];

  /**
   * The verifier Lambda handler entry point.
   *
   * @default 'index.handler'
   */
  readonly handler?: string;

  /**
   * The verifier Lambda runtime. The verifier code is Python by default.
   *
   * @default lambda.Runtime.PYTHON_3_12
   */
  readonly runtime?: lambda.Runtime;

  /**
   * Verifier Lambda architecture.
   *
   * @default lambda.Architecture.ARM_64
   */
  readonly architecture?: lambda.Architecture;

  /**
   * Verifier Lambda timeout.
   *
   * @default Duration.seconds(10)
   */
  readonly timeout?: Duration;
}

interface RoutingEntry {
  readonly repo: string;
  readonly topic: string;
  readonly queueUrl: string;
  readonly queueArn: string;
}

/**
 * The WHISTLE hub in the whistle/bone trigger model (see 55minutes ADR 0002):
 * the single, shared, centralised front door that turns a verified GitHub
 * webhook into a per-project wake.
 *
 * Instantiated ONCE, in the 55minutes hub account. There is NO EventBridge bus:
 * the verifier Lambda (which must exist for HMAC anyway) does the whole router
 * job itself, which keeps the design simple and sidesteps EventBridge's
 * inability to target a cross-account SQS queue. The flow:
 *
 * 1. A GitHub repo webhook POSTs to the public HTTP API `POST /events`.
 * 2. The verifier checks the `X-Hub-Signature-256` HMAC against the shared
 *    secret, rejects a bad signature before parsing, filters to real triggers,
 *    and looks the repo up in its routing table.
 * 3. For a matched repo it does two direct SDK calls:
 *    - `iot:Publish` to `crew/<project>/wake` — the whistle, a dumb fan-out
 *      "there's a bone" wake every subscribed crew hears; and
 *    - `sqs:SendMessage` to the project's {@link CrewCommandQueue} in its own
 *      deploy account — the bone, cross-account (allowed from a Lambda; only the
 *      EventBridge SQS *target* is account-restricted), durable, one-winner.
 *
 * Isolation between projects is by IoT topic-scoping (each crew's IoT policy
 * locks it to its granted `crew/<project>/#` subtrees) and the per-queue
 * resource policy, NOT by separate accounts — IoT Core is one shared broker and
 * the topics are namespaces on it. Crew-to-project cardinality is deliberately
 * open: nothing here assumes how many crews listen on a topic or drain a queue.
 *
 * If a shared event spine is ever wanted (audit, metrics, replay, other
 * consumers), the verifier can additionally `PutEvents` onto an EventBridge bus
 * at that point — adding the bus later is not a one-way door. It is left out now
 * because there is no second consumer and it bought nothing but the
 * cross-account friction this design removes.
 *
 * Sibling to {@link CrewWebhookIngress} (the VPC-push variant), not a replacement.
 */
export class CrewWakeHub extends Construct {
  /** The public HTTP API — the `POST /events` front door. */
  public readonly api: apigw.HttpApi;
  /** The HMAC-verify + router Lambda. */
  public readonly verifier: lambda.Function;
  /** The verifier's execution role — the principal a CrewCommandQueue authorises as its senderRoleArn. */
  public readonly verifierRole: iam.Role;

  private readonly routing: RoutingEntry[] = [];

  constructor(scope: Construct, id: string, props: CrewWakeHubProps) {
    super(scope, id);

    this.verifierRole = new iam.Role(this, 'VerifierRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // The verifier may read ONLY the webhook secret. Scoped, never a wildcard.
    this.verifierRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'ReadWebhookSecret',
        actions: ['secretsmanager:GetSecretValue'],
        resources: [props.webhookSecretArn],
      }),
    );

    this.verifier = new lambda.Function(this, 'Verifier', {
      runtime: props.runtime ?? lambda.Runtime.PYTHON_3_12,
      architecture: props.architecture ?? lambda.Architecture.ARM_64,
      handler: props.handler ?? 'index.handler',
      code: props.verifierCode,
      role: this.verifierRole,
      timeout: props.timeout ?? Duration.seconds(10),
      environment: {
        GITHUB_WEBHOOK_SECRET_ARN: props.webhookSecretArn,
        // The routing table (repoFullName -> {topic, queueUrl, queueArn}) is
        // injected as JSON. Lazy so addProject calls made after construction
        // are included — the token resolves at synth, after all of them run.
        CREW_ROUTING_TABLE: Lazy.string({
          produce: () => JSON.stringify(this.routingTable()),
        }),
      },
    });

    this.api = new apigw.HttpApi(this, 'Api', {
      description: 'Crew wake hub — GitHub webhook ingress (POST /events)',
    });
    this.api.addRoutes({
      path: '/events',
      methods: [apigw.HttpMethod.POST],
      integration: new apigwi.HttpLambdaIntegration('EventsIntegration', this.verifier),
    });

    for (const project of props.projects ?? []) {
      this.addProject(project);
    }
  }

  /**
   * Wire one project onto the hub: add its routing-table entry, grant the
   * verifier `iot:Publish` on the project's whistle topic, and grant it
   * cross-account `sqs:SendMessage` on the project's bone queue. Call this to
   * onboard a project after construction.
   */
  public addProject(project: CrewWakeHubProject): void {
    const topic = project.wakeTopic ?? `crew/${project.projectSlug}/wake`;

    this.routing.push({
      repo: project.repoFullName,
      topic,
      queueArn: project.commandQueueArn,
      queueUrl: this.arnToUrl(project.commandQueueArn),
    });

    // The whistle: publish on exactly this project's topic.
    this.verifierRole.addToPolicy(
      new iam.PolicyStatement({
        sid: `Whistle${this.sanitize(project.projectSlug)}`,
        actions: ['iot:Publish'],
        resources: [`arn:aws:iot:${Stack.of(this).region}:${Stack.of(this).account}:topic/${topic}`],
      }),
    );

    // The bone: send to this project's cross-account queue. The queue's own
    // resource policy (CrewCommandQueue) authorises this verifier role.
    this.verifierRole.addToPolicy(
      new iam.PolicyStatement({
        sid: `Bone${this.sanitize(project.projectSlug)}`,
        actions: ['sqs:SendMessage'],
        resources: [project.commandQueueArn],
      }),
    );
  }

  // The routing table injected into the Lambda env, built from all projects
  // registered by construction time or a later addProject call. Resolved inside
  // a Lazy token so order of addProject vs synth does not matter.
  private routingTable(): { [repo: string]: Omit<RoutingEntry, 'repo'> } {
    const table: { [repo: string]: Omit<RoutingEntry, 'repo'> } = {};
    for (const r of this.routing) {
      table[r.repo] = { topic: r.topic, queueUrl: r.queueUrl, queueArn: r.queueArn };
    }
    return table;
  }

  private arnToUrl(queueArn: string): string {
    const [, , , region, account, name] = queueArn.split(':');
    return `https://sqs.${region}.amazonaws.com/${account}/${name}`;
  }

  private sanitize(s: string): string {
    return s.replace(/[^A-Za-z0-9]/g, '');
  }
}
