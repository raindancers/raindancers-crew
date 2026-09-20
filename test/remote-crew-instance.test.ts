import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CrewArchitecture, RemoteCrewInstance } from '../src';

const BOUNDARY =
  'arn:aws:iam::123456789012:policy/kirocrew-ec2-boundary';

function synth(props?: Partial<Parameters<typeof mk>[0]>) {
  return mk(props);
}

function mk(overrides?: Record<string, unknown>) {
  const app = new App();
  const stack = new Stack(app, 'TestStack', {
    env: { account: '123456789012', region: 'eu-west-2' },
  });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  new RemoteCrewInstance(stack, 'Crew', {
    vpc,
    permissionsBoundaryArn: BOUNDARY,
    ...(overrides as object),
  });
  return Template.fromStack(stack);
}

describe('RemoteCrewInstance', () => {
  test('creates exactly one EC2 instance', () => {
    synth().resourceCountIs('AWS::EC2::Instance', 1);
  });

  test('instance role carries the required permissions boundary', () => {
    synth().hasResourceProperties('AWS::IAM::Role', {
      PermissionsBoundary: BOUNDARY,
    });
  });

  test('role attaches the SSM core managed policy', () => {
    const t = synth();
    t.hasResourceProperties('AWS::IAM::Role', {
      ManagedPolicyArns: Match.arrayWith([
        Match.objectLike({
          'Fn::Join': Match.arrayWith([
            Match.arrayWith([
              Match.stringLikeRegexp('AmazonSSMManagedInstanceCore'),
            ]),
          ]),
        }),
      ]),
    });
  });

  test('security group has NO inbound rules by default (SSM-only)', () => {
    synth().hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.absent(),
    });
  });

  test('opens tcp/22 only when allowSshCidr is set', () => {
    const t = synth({ allowSshCidr: '203.0.113.0/24' });
    t.hasResourceProperties('AWS::EC2::SecurityGroup', {
      SecurityGroupIngress: Match.arrayWith([
        Match.objectLike({ FromPort: 22, ToPort: 22, CidrIp: '203.0.113.0/24' }),
      ]),
    });
  });

  test('rejects an SSH CIDR wider than /16', () => {
    expect(() => synth({ allowSshCidr: '10.0.0.0/8' })).toThrow(/CIDR no wider than \/16/);
  });

  test('enforces IMDSv2 (token required)', () => {
    synth().hasResourceProperties('AWS::EC2::LaunchTemplate', {
      LaunchTemplateData: Match.objectLike({
        MetadataOptions: Match.objectLike({ HttpTokens: 'required' }),
      }),
    });
  });

  test('root volume is encrypted gp3', () => {
    synth().hasResourceProperties('AWS::EC2::Instance', {
      BlockDeviceMappings: Match.arrayWith([
        Match.objectLike({
          Ebs: Match.objectLike({ Encrypted: true, VolumeType: 'gp3' }),
        }),
      ]),
    });
  });

  test('blocks stack completion on a WaitCondition', () => {
    const t = synth();
    t.resourceCountIs('AWS::CloudFormation::WaitCondition', 1);
    t.resourceCountIs('AWS::CloudFormation::WaitConditionHandle', 1);
  });

  test('grants scoped s3:GetObject only when an S3 source is configured', () => {
    const t = synth({
      source: { sourceBucket: 'my-bucket', sourceKey: 'kc/src.tar.gz' },
    });
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 's3:GetObject',
            Resource: 'arn:aws:s3:::my-bucket/kc/src.tar.gz',
          }),
        ]),
      }),
    });
  });

  test('no S3 grant on the default git-clone path', () => {
    const t = synth();
    const policies = t.findResources('AWS::IAM::Policy');
    const json = JSON.stringify(policies);
    expect(json).not.toContain('s3:GetObject');
  });

  test('rejects a source bucket without a key', () => {
    expect(() => synth({ source: { sourceBucket: 'b' } })).toThrow(/sourceKey is required/);
  });

  test('x86_64 architecture selects an x86 instance type by default', () => {
    const t = synth({ architecture: CrewArchitecture.X86_64 });
    t.hasResourceProperties('AWS::EC2::Instance', {
      InstanceType: 'm7i.2xlarge',
    });
  });

  test('writes the kirocrew:instance discovery tag', () => {
    synth({ stackTag: 'fiftyfive' }).hasResourceProperties('AWS::EC2::Instance', {
      Tags: Match.arrayWith([
        Match.objectLike({ Key: 'kirocrew:instance', Value: 'fiftyfive' }),
      ]),
    });
  });

  test('bundled bootstrap asset ships under src/assets (consumer path)', () => {
    // Regression guard: the construct reads bootstrap.sh at runtime relative
    // to the package root. jsii/tsc does NOT copy non-TS files into lib/, so
    // the asset must live under src/assets and be resolvable from a compiled
    // lib/ location. Assert it exists where a consumer install would find it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const asset = path.join(__dirname, '..', 'src', 'assets', 'bootstrap.sh');
    expect(fs.existsSync(asset)).toBe(true);
  });

  test('userData embeds the bootstrap body and a pinned ref', () => {
    const app = new App();
    const stack = new Stack(app, 'S', {
      env: { account: '123456789012', region: 'eu-west-2' },
    });
    const vpc = new ec2.Vpc(stack, 'Vpc');
    const crew = new RemoteCrewInstance(stack, 'Crew', {
      vpc,
      permissionsBoundaryArn: BOUNDARY,
      source: { kirocrewRef: 'v0.8.0' },
    });
    const rendered = stack.resolve(crew.instance.userData.render());
    const json = JSON.stringify(rendered);
    expect(json).toContain('KIROCREW_REF=');
    expect(json).toContain('v0.8.0');
    expect(json).toContain('KiroCrew bootstrap');
  });
});
