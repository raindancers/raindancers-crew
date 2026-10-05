import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CrewRolesAnywhereRole } from '../src';

const TRUST_ANCHOR =
  'arn:aws:rolesanywhere:ap-southeast-2:641001211783:trust-anchor/05fcab6e-6894-400f-abb2-46f998b00104';
const CREW_ACCOUNT = '641001211783';
const PROJECT_ACCOUNT = '382884105073';

function synth(props?: Partial<Parameters<typeof mk>[0]>) {
  return mk({
    trustAnchorArn: TRUST_ANCHOR,
    certCn: 'crew-functional-self',
    projectSlug: 'functional-self',
    projectAccountId: PROJECT_ACCOUNT,
    ...props,
  });
}

function mk(p: {
  trustAnchorArn: string;
  certCn: string;
  projectSlug: string;
  projectAccountId: string;
  projectRegion?: string;
  wakeTopic?: string;
  createProfile?: boolean;
}) {
  const app = new App();
  // The crew identity lives in the crew (55minutes) account / control-plane region.
  const stack = new Stack(app, 'S', { env: { account: CREW_ACCOUNT, region: 'ap-southeast-2' } });
  const c = new CrewRolesAnywhereRole(stack, 'CrewId', p);
  return { t: Template.fromStack(stack), c };
}

describe('CrewRolesAnywhereRole', () => {
  test('creates one IAM role assumed by the Roles Anywhere service', () => {
    const { t } = synth();
    t.resourceCountIs('AWS::IAM::Role', 1);
    t.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: { Service: 'rolesanywhere.amazonaws.com' },
            Action: Match.arrayWith(['sts:AssumeRole', 'sts:TagSession']),
          }),
        ]),
      }),
    });
  });

  test('trust policy pins to BOTH the cert CN and the trust anchor', () => {
    const { t } = synth();
    t.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Condition: {
              StringEquals: { 'aws:PrincipalTag/x509Subject/CN': 'crew-functional-self' },
              ArnEquals: { 'aws:SourceArn': TRUST_ANCHOR },
            },
          }),
        ]),
      }),
    });
  });

  test('grants cross-account SQS drain on the DERIVED queue ARN (never imported)', () => {
    const { t, c } = synth();
    expect(c.commandQueueArn).toBe(
      `arn:aws:sqs:ap-southeast-2:${PROJECT_ACCOUNT}:crew-commands-functional-self`,
    );
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'DrainBone',
            Action: Match.arrayWith(['sqs:ReceiveMessage', 'sqs:DeleteMessage']),
            Resource: `arn:aws:sqs:ap-southeast-2:${PROJECT_ACCOUNT}:crew-commands-functional-self`,
          }),
        ]),
      }),
    });
  });

  test('grants IoT connect/subscribe/receive scoped to the whistle topic', () => {
    const { t, c } = synth();
    expect(c.wakeTopic).toBe('crew/functional-self/wake');
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'HearWhistleSubscribe',
            Action: 'iot:Subscribe',
            Resource: `arn:aws:iot:ap-southeast-2:${CREW_ACCOUNT}:topicfilter/crew/functional-self/wake`,
          }),
          Match.objectLike({
            Sid: 'HearWhistleReceive',
            Action: 'iot:Receive',
            Resource: `arn:aws:iot:ap-southeast-2:${CREW_ACCOUNT}:topic/crew/functional-self/wake`,
          }),
        ]),
      }),
    });
  });

  test('creates a Roles Anywhere profile scoped to the role by default', () => {
    const { t } = synth();
    t.resourceCountIs('AWS::RolesAnywhere::Profile', 1);
    t.hasResourceProperties('AWS::RolesAnywhere::Profile', { Name: 'crew-functional-self' });
  });

  test('createProfile=false suppresses the profile', () => {
    const { t } = synth({ createProfile: false });
    t.resourceCountIs('AWS::RolesAnywhere::Profile', 0);
  });

  test('derives queue ARN in the project region when projectRegion is given', () => {
    const { c } = synth({ projectRegion: 'eu-west-2' });
    expect(c.commandQueueArn).toBe(
      `arn:aws:sqs:eu-west-2:${PROJECT_ACCOUNT}:crew-commands-functional-self`,
    );
  });
});
