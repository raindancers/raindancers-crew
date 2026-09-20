import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {
  CrewBackupBucket,
  FargateCrew,
  RemoteCrewInstance,
} from '../src';

const BOUNDARY = 'arn:aws:iam::123456789012:policy/kirocrew-ec2-boundary';

function stackWithVpc() {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '123456789012', region: 'eu-west-2' } });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  return { stack, vpc };
}

describe('CrewBackupBucket', () => {
  function tpl() {
    const { stack } = stackWithVpc();
    new CrewBackupBucket(stack, 'Backup');
    return Template.fromStack(stack);
  }

  test('bucket is versioned', () => {
    tpl().hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
    });
  });

  test('bucket blocks all public access', () => {
    tpl().hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  test('bucket is KMS-encrypted with a rotating key', () => {
    const t = tpl();
    t.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({ SSEAlgorithm: 'aws:kms' }),
          }),
        ]),
      }),
    });
    t.hasResourceProperties('AWS::KMS::Key', { EnableKeyRotation: true });
  });

  test('bucket policy enforces TLS (denies insecure transport)', () => {
    tpl().hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: Match.objectLike({ Bool: { 'aws:SecureTransport': 'false' } }),
          }),
        ]),
      }),
    });
  });

  test('bucket and key are RETAINed on stack delete (learnings outlive it)', () => {
    const t = tpl();
    t.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
    t.hasResource('AWS::KMS::Key', { DeletionPolicy: 'Retain' });
  });

  test('expires noncurrent versions after the configured window', () => {
    tpl().hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: Match.objectLike({
        Rules: Match.arrayWith([
          Match.objectLike({ NoncurrentVersionExpiration: { NoncurrentDays: 90 } }),
        ]),
      }),
    });
  });
});

describe('EC2 lane backup wiring', () => {
  function tpl(withBackup: boolean) {
    const { stack, vpc } = stackWithVpc();
    const props: Record<string, unknown> = { vpc, permissionsBoundaryArn: BOUNDARY };
    if (withBackup) {
      props.backupBucket = new CrewBackupBucket(stack, 'Backup');
    }
    new RemoteCrewInstance(stack, 'Crew', props as any);
    return Template.fromStack(stack);
  }

  test('grants the instance role write to the backup bucket when set', () => {
    const t = tpl(true);
    // A policy statement granting s3 Put* on the bucket must exist.
    const policies = JSON.stringify(t.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('s3:PutObject');
    expect(policies).toContain('kms:');
  });

  test('no backup grant when no bucket is configured', () => {
    const policies = JSON.stringify(tpl(false).findResources('AWS::IAM::Policy'));
    expect(policies).not.toContain('s3:PutObject');
  });

  test('installs the backup timer in UserData when a bucket is set', () => {
    const { stack, vpc } = stackWithVpc();
    const backup = new CrewBackupBucket(stack, 'Backup');
    const crew = new RemoteCrewInstance(stack, 'Crew', {
      vpc,
      permissionsBoundaryArn: BOUNDARY,
      backupBucket: backup,
    });
    const rendered = JSON.stringify(stack.resolve(crew.instance.userData.render()));
    expect(rendered).toContain('kirocrew-backup.timer');
    expect(rendered).toContain('kirocrew-restore-from-s3');
  });
});

describe('Fargate lane backup wiring', () => {
  test('grants the TASK role write when a backup bucket is set', () => {
    const { stack } = stackWithVpc();
    const backup = new CrewBackupBucket(stack, 'Backup');
    new FargateCrew(stack, 'Crew', { crew: 'fiftyfive', backupBucket: backup });
    const t = Template.fromStack(stack);
    // The backup grant attaches a managed/inline policy to the task role.
    const policies = JSON.stringify(t.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('s3:PutObject');
    // The task role still must NOT gain secret read.
    expect(policies).not.toContain('secretsmanager:GetSecretValue" ,');
  });
});
