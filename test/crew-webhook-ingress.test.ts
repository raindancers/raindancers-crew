import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { CrewWebhookIngress, EcsCrewHost } from '../src';

const BOUNDARY = 'arn:aws:iam::123456789012:policy/kirocrew-ec2-boundary';

function fixture(crewCount = 1) {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '123456789012', region: 'ap-southeast-2' } });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  const host = new EcsCrewHost(stack, 'Fleet', {
    vpc,
    permissionsBoundaryArn: BOUNDARY,
    crewCount,
  });
  return { stack, vpc, host };
}

// Count resources whose logical id sits under a construct-path prefix, so the
// ingress-added SNS/Lambda are told apart from the ASG capacity provider's own
// drain-hook SNS/Lambda.
function countUnder(t: Template, type: string, prefix: string): number {
  const found = t.findResources(type);
  return Object.keys(found).filter((id) => id.startsWith(prefix)).length;
}

describe('CrewWebhookIngress - off by default', () => {
  test('a plain EcsCrewHost adds NO ingress SNS topic or ingress Lambda', () => {
    const { stack } = fixture();
    const t = Template.fromStack(stack);
    // Nothing under an "Ingress" construct path exists (the ASG drain-hook
    // topic/lambda are a different construct and are not the webhook's).
    expect(countUnder(t, 'AWS::SNS::Topic', 'Ingress')).toBe(0);
    expect(countUnder(t, 'AWS::Lambda::Function', 'Ingress')).toBe(0);
  });
});

describe('CrewWebhookIngress - wired', () => {
  function withIngress() {
    const { stack, vpc, host } = fixture();
    new CrewWebhookIngress(stack, 'Ingress', {
      vpc,
      host,
      permissionsBoundaryArn: BOUNDARY,
      code: lambda.Code.fromInline('exports.handler = async () => ({});'),
    });
    return Template.fromStack(stack);
  }

  test('creates one ingress SNS topic and an in-VPC arm64 Lambda under the boundary', () => {
    const t = withIngress();
    expect(countUnder(t, 'AWS::SNS::Topic', 'Ingress')).toBe(1);
    t.hasResourceProperties('AWS::Lambda::Function', {
      Architectures: ['arm64'],
      VpcConfig: Match.objectLike({ SubnetIds: Match.anyValue() }),
    });
    t.hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: BOUNDARY,
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Principal: Match.objectLike({ Service: 'lambda.amazonaws.com' }),
          }),
        ]),
      }),
    });
  });

  test('opens the crew task SG to the ingress Lambda SG on the crew port ONLY, never a CIDR', () => {
    const t = withIngress();
    // Same-stack SG-to-SG rule renders as an inline ingress on the task SG.
    t.hasResourceProperties('AWS::EC2::SecurityGroup', {
      GroupDescription: Match.stringLikeRegexp('egress only'),
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({
          FromPort: 5476,
          ToPort: 5476,
          IpProtocol: 'tcp',
          SourceSecurityGroupId: Match.anyValue(),
        }),
      ]),
    });
    // No CIDR-sourced rule anywhere among the SG ingress entries.
    const sgs = t.findResources('AWS::EC2::SecurityGroup');
    for (const sg of Object.values(sgs)) {
      const ingress = (sg.Properties.SecurityGroupIngress ?? []) as any[];
      for (const rule of ingress) {
        // The only inbound rule the construct adds is the SG-sourced webhook one.
        if (rule.FromPort === 5476) {
          expect(rule.CidrIp).toBeUndefined();
          expect(rule.SourceSecurityGroupId).toBeDefined();
        }
      }
    }
  });
});
