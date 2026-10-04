import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CrewWakeHub, CrewWakeHubProject } from '../src';

const SECRET = 'arn:aws:secretsmanager:ap-southeast-2:641001211783:secret:gh-webhook-abc';
const QUEUE = 'arn:aws:sqs:eu-west-2:044259389930:crew-commands-functional-self';

const PROJECT: CrewWakeHubProject = {
  projectSlug: 'functional-self',
  repoFullName: 'bwip-holdings/functional-self',
  commandQueueArn: QUEUE,
};

function synth(projects: CrewWakeHubProject[] = []) {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '641001211783', region: 'ap-southeast-2' } });
  new CrewWakeHub(stack, 'Hub', {
    verifierCode: lambda.Code.fromInline('def handler(e, c): return {"statusCode": 202}'),
    webhookSecretArn: SECRET,
    projects,
  });
  return Template.fromStack(stack);
}

describe('CrewWakeHub - core', () => {
  test('creates the public HTTP API with a POST /events route and a Python arm64 verifier, no EventBridge bus', () => {
    const t = synth();
    t.resourceCountIs('AWS::Events::EventBus', 0);
    t.resourceCountIs('AWS::Events::Rule', 0);
    t.hasResourceProperties('AWS::ApiGatewayV2::Api', { ProtocolType: 'HTTP' });
    t.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'POST /events' });
    t.hasResourceProperties('AWS::Lambda::Function', {
      Architectures: ['arm64'],
      Runtime: Match.stringLikeRegexp('^python'),
    });
  });

  test('the verifier gets the secret ARN and a routing table in its environment', () => {
    const t = synth([PROJECT]);
    t.hasResourceProperties('AWS::Lambda::Function', {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          GITHUB_WEBHOOK_SECRET_ARN: SECRET,
          CREW_ROUTING_TABLE: Match.stringLikeRegexp('bwip-holdings/functional-self'),
        }),
      }),
    });
  });

  test('the verifier may read ONLY the webhook secret (scoped, no wildcard)', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'secretsmanager:GetSecretValue',
            Resource: SECRET,
          }),
        ]),
      }),
    });
  });
});

describe('CrewWakeHub - per project', () => {
  test('grants the verifier iot:Publish on the project topic and cross-account sqs:SendMessage on its queue', () => {
    const t = synth([PROJECT]);
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'iot:Publish',
            Resource: Match.stringLikeRegexp('topic/crew/functional-self/wake'),
          }),
          Match.objectLike({
            Action: 'sqs:SendMessage',
            Resource: QUEUE,
          }),
        ]),
      }),
    });
  });

  test('a project added after construction still lands in the routing table and grants', () => {
    const app = new App();
    const stack = new Stack(app, 'S', { env: { account: '641001211783', region: 'ap-southeast-2' } });
    const hub = new CrewWakeHub(stack, 'Hub', {
      verifierCode: lambda.Code.fromInline('def handler(e, c): return {}'),
      webhookSecretArn: SECRET,
    });
    hub.addProject(PROJECT);
    const t = Template.fromStack(stack);
    t.hasResourceProperties('AWS::Lambda::Function', {
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          CREW_ROUTING_TABLE: Match.stringLikeRegexp('bwip-holdings/functional-self'),
        }),
      }),
    });
  });
});
