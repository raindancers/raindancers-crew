import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { ICrewBackupBucket } from './remote-crew-instance-props';

/**
 * Properties for {@link CrewBackupBucket}.
 */
export interface CrewBackupBucketProps {
  /**
   * Explicit bucket name. Omit to let CloudFormation generate one.
   *
   * @default - CloudFormation-generated
   */
  readonly bucketName?: string;

  /**
   * Days after which a NONCURRENT snapshot version is expired. Current
   * versions are always kept. Set 0 to keep all versions forever.
   *
   * @default 90
   */
  readonly noncurrentVersionExpirationDays?: number;

  /**
   * What happens to the bucket when the stack is destroyed. Defaults to
   * RETAIN — the whole point is that the crew's learnings outlive the
   * instance, so the backup must outlive a stack teardown too.
   *
   * @default RemovalPolicy.RETAIN
   */
  readonly removalPolicy?: RemovalPolicy;
}

/**
 * A hardened S3 bucket for KiroCrew snapshot backups.
 *
 * The snapshot bundle produced by `kirocrew snapshot --purpose backup` is
 * already redaction-scrubbed (the signing key, `.env`, and execution logs
 * never ship), so this stores portable crew state, not raw secrets. The bucket
 * is nonetheless locked down as if it did: SSE-KMS at rest, all public access
 * blocked, TLS-only access, versioned so an overwrite cannot destroy history,
 * and a lifecycle rule that expires stale noncurrent versions.
 *
 * Use {@link grantWrite} to let an instance/task role push snapshots, and
 * {@link grantRead} to let a replacement instance pull them for restore.
 */
export class CrewBackupBucket extends Construct implements ICrewBackupBucket {
  /** The backup bucket. */
  public readonly bucket: s3.IBucket;
  /** The KMS key encrypting the bucket. */
  public readonly key: kms.Key;

  constructor(scope: Construct, id: string, props: CrewBackupBucketProps = {}) {
    super(scope, id);

    this.key = new kms.Key(this, 'Key', {
      description: 'KiroCrew snapshot backup bucket encryption key',
      enableKeyRotation: true,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
    });

    const noncurrentDays = props.noncurrentVersionExpirationDays ?? 90;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: props.bucketName,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.key,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: props.removalPolicy ?? RemovalPolicy.RETAIN,
      lifecycleRules:
        noncurrentDays > 0
          ? [
            {
              // Keep current snapshots forever; expire superseded versions so
              // the bucket does not grow without bound.
              noncurrentVersionExpiration: Duration.days(noncurrentDays),
              abortIncompleteMultipartUploadAfter: Duration.days(7),
            },
          ]
          : undefined,
    });
  }

  /**
   * Grant a principal permission to WRITE snapshots (and the KMS encrypt it
   * needs). Used by the crew instance/task role that pushes backups.
   */
  public grantWrite(grantee: iam.IGrantable): void {
    this.bucket.grantWrite(grantee);
    this.key.grantEncryptDecrypt(grantee);
  }

  /**
   * Grant a principal permission to READ snapshots (and the KMS decrypt it
   * needs). Used by a replacement instance restoring from backup.
   */
  public grantRead(grantee: iam.IGrantable): void {
    this.bucket.grantRead(grantee);
    this.key.grantDecrypt(grantee);
  }
}
