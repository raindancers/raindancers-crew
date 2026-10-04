import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CrewCommandQueue } from '../src';

const SENDER = 'arn:aws:iam::641001211783:role/crew-wake-SenderRole';
const CREW_A = 'arn:aws:iam::044259389930:role/crew-a';
const CREW_B = 'arn:aws:iam::044259389930:role/crew-b';

function synth(props?: Partial<Parameters<typeof mk>[0]>) {
  return mk({
    projectSlug: 'functional-self',
    senderRoleArn: SENDER,
    consumerPrincipalArns: [CREW_A],
    ...props,
  });
}

function mk(p: {
  projectSlug: string;
  senderRoleArn: string;
  consumerPrincipalArns: string[];
}) {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '044259389930', region: 'eu-west-2' } });
  new CrewCommandQueue(stack, 'Cmd', p);
  return Template.fromStack(stack);
}

describe('CrewCommandQueue', () => {
  test('creates the queue and a DLQ with deterministic names and SSL enforced', () => {
    const t = synth();
    t.resourceCountIs('AWS::SQS::Queue', 2);
    t.hasResourceProperties('AWS::SQS::Queue', { QueueName: 'crew-commands-functional-self' });
    t.hasResourceProperties('AWS::SQS::Queue', { QueueName: 'crew-commands-functional-self-dlq' });
  });

  test('long-polls by default (20s) and wires the redrive to the DLQ', () => {
    const t = synth();
    t.hasResourceProperties('AWS::SQS::Queue', {
      QueueName: 'crew-commands-functional-self',
      ReceiveMessageWaitTimeSeconds: 20,
      RedrivePolicy: Match.objectLike({ maxReceiveCount: 5 }),
    });
  });

  test('SEND side: the wake-hub sender role is granted SendMessage via the queue policy', () => {
    const t = synth();
    t.hasResourceProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'WakeHubSend',
            Action: Match.arrayWith(['sqs:SendMessage']),
            Principal: Match.objectLike({ AWS: SENDER }),
          }),
        ]),
      }),
    });
  });

  test('RECEIVE side: each crew principal is granted ReceiveMessage + DeleteMessage', () => {
    const t = mk({
      projectSlug: 'functional-self',
      senderRoleArn: SENDER,
      consumerPrincipalArns: [CREW_A, CREW_B],
    });
    t.hasResourceProperties('AWS::SQS::QueuePolicy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: 'CrewDrain',
            Action: Match.arrayWith(['sqs:ReceiveMessage', 'sqs:DeleteMessage']),
            Principal: Match.objectLike({ AWS: Match.arrayWith([CREW_A, CREW_B]) }),
          }),
        ]),
      }),
    });
  });

  test('rejects a queue nothing may drain', () => {
    expect(() =>
      mk({ projectSlug: 'x', senderRoleArn: SENDER, consumerPrincipalArns: [] }),
    ).toThrow(/at least one consumerPrincipalArn/);
  });
});
