import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { FargateCpuArchitecture, FargateCrew, FargateCrewBase } from '../src';

const BOUNDARY = 'arn:aws:iam::123456789012:policy/kirocrew-crew-boundary';

function baseTemplate(props?: Record<string, unknown>) {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '123456789012', region: 'eu-west-2' } });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  new FargateCrewBase(stack, 'Base', { vpc, ...(props as object) });
  return Template.fromStack(stack);
}

function crewTemplate(props?: Record<string, unknown>) {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '123456789012', region: 'eu-west-2' } });
  new FargateCrew(stack, 'Crew', { crew: 'fiftyfive', ...(props as object) });
  return Template.fromStack(stack);
}

describe('FargateCrewBase', () => {
  test('creates one ECS cluster named from the tag', () => {
    baseTemplate({ stackTag: 'fiftyfive' }).hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: 'kirocrew-crew-fiftyfive',
    });
  });

  test('task security group has NO inbound rules (egress only)', () => {
    baseTemplate().hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.absent(),
    });
  });

  test('rejects an invalid stackTag', () => {
    expect(() => baseTemplate({ stackTag: 'bad/tag' })).toThrow();
  });
});

describe('FargateCrew', () => {
  test('creates the derived log group', () => {
    crewTemplate().hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/kirocrew/crew/fiftyfive',
    });
  });

  test('execution and task roles carry derived names', () => {
    const t = crewTemplate();
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'kirocrew-crew-fiftyfive-exec',
    });
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'kirocrew-crew-fiftyfive-task',
    });
  });

  test('both roles condition assume-role on aws:SourceAccount', () => {
    const t = crewTemplate();
    const roles = t.findResources('AWS::IAM::Role');
    const roleValues = Object.values(roles);
    expect(roleValues).toHaveLength(2);
    for (const r of roleValues) {
      const stmt = r.Properties.AssumeRolePolicyDocument.Statement[0];
      expect(stmt.Condition.StringEquals['aws:SourceAccount']).toBeDefined();
    }
  });

  test('execution role reads secrets scoped to this crew only', () => {
    crewTemplate().hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'secretsmanager:GetSecretValue',
            Resource: Match.objectLike({
              'Fn::Join': Match.arrayWith([
                Match.arrayWith([
                  Match.stringLikeRegexp('secret:kirocrew/crew/fiftyfive/\\*'),
                ]),
              ]),
            }),
          }),
        ]),
      }),
    });
  });

  test('TASK role carries NO policies and NEVER secretsmanager:GetSecretValue', () => {
    // The single AWS::IAM::Policy in the template belongs to the EXECUTION role.
    // The task role must have no inline policy at all, and the whole template
    // must not grant GetSecretValue anywhere it could reach the task role.
    const t = crewTemplate();
    const policies = t.findResources('AWS::IAM::Policy');
    // Exactly one policy resource (the exec role's), attached to the exec role.
    expect(Object.keys(policies)).toHaveLength(1);
    const policy = Object.values(policies)[0];
    const rolesRef = JSON.stringify(policy.Properties.Roles);
    expect(rolesRef).toContain('ExecutionRole');
    expect(rolesRef).not.toContain('TaskRole');
  });

  test('no execution-role S3/ECR grant on the public-registry default', () => {
    const json = JSON.stringify(crewTemplate().findResources('AWS::IAM::Policy'));
    expect(json).not.toContain('ecr:BatchGetImage');
  });

  test('scopes ECR pull to the given repo when private registry is set', () => {
    const repo = 'arn:aws:ecr:eu-west-2:123456789012:repository/kirocrew/crew';
    const t = crewTemplate({ ecrRepositoryArn: repo });
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Action: 'ecr:GetAuthorizationToken', Resource: '*' }),
          Match.objectLike({
            Action: Match.arrayWith(['ecr:BatchGetImage']),
            Resource: repo,
          }),
        ]),
      }),
    });
  });

  test('applies the permissions boundary when provided', () => {
    const t = crewTemplate({ permissionsBoundaryArn: BOUNDARY });
    t.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'kirocrew-crew-fiftyfive-exec',
      PermissionsBoundary: BOUNDARY,
    });
  });

  test('deploys without a boundary (declared degraded mode)', () => {
    const t = crewTemplate();
    const roles = t.findResources('AWS::IAM::Role');
    for (const r of Object.values(roles)) {
      expect(r.Properties.PermissionsBoundary).toBeUndefined();
    }
  });

  test('rejects an invalid boundary ARN', () => {
    expect(() =>
      crewTemplate({ permissionsBoundaryArn: 'arn:aws:iam::123456789012:policy/wrong' }),
    ).toThrow(/kirocrew-crew-boundary/);
  });

  test('rejects a crew name with a trailing hyphen', () => {
    expect(() => crewTemplate({ crew: 'bad-' })).toThrow();
  });

  test('rejects an unlisted log retention value', () => {
    expect(() => crewTemplate({ logRetentionDays: 45 })).toThrow(/logRetentionDays/);
  });

  test('unused arch enum member exists for jsii consumers', () => {
    expect(FargateCpuArchitecture.ARM64).toBe('ARM64');
  });
});
