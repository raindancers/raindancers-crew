# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### CrewBackupBucket <a name="CrewBackupBucket" id="@raindancers/raindancers-crew.CrewBackupBucket"></a>

- *Implements:* <a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a>

A hardened S3 bucket for KiroCrew snapshot backups.

The snapshot bundle produced by `kirocrew snapshot --purpose backup` is
already redaction-scrubbed (the signing key, `.env`, and execution logs
never ship), so this stores portable crew state, not raw secrets. The bucket
is nonetheless locked down as if it did: SSE-KMS at rest, all public access
blocked, TLS-only access, versioned so an overwrite cannot destroy history,
and a lifecycle rule that expires stale noncurrent versions.

Use {@link grantWrite} to let an instance/task role push snapshots, and
{@link grantRead} to let a replacement instance pull them for restore.

#### Initializers <a name="Initializers" id="@raindancers/raindancers-crew.CrewBackupBucket.Initializer"></a>

```typescript
import { CrewBackupBucket } from '@raindancers/raindancers-crew'

new CrewBackupBucket(scope: Construct, id: string, props?: CrewBackupBucketProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.Initializer.parameter.props">props</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewBackupBucketProps">CrewBackupBucketProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@raindancers/raindancers-crew.CrewBackupBucket.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@raindancers/raindancers-crew.CrewBackupBucket.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Optional</sup> <a name="props" id="@raindancers/raindancers-crew.CrewBackupBucket.Initializer.parameter.props"></a>

- *Type:* <a href="#@raindancers/raindancers-crew.CrewBackupBucketProps">CrewBackupBucketProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.with">with</a></code> | Applies one or more mixins to this construct. |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.grantRead">grantRead</a></code> | Grant a principal permission to READ snapshots (and the KMS decrypt it needs). |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.grantWrite">grantWrite</a></code> | Grant a principal permission to WRITE snapshots (and the KMS encrypt it needs). |

---

##### `toString` <a name="toString" id="@raindancers/raindancers-crew.CrewBackupBucket.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="@raindancers/raindancers-crew.CrewBackupBucket.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="@raindancers/raindancers-crew.CrewBackupBucket.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

##### `grantRead` <a name="grantRead" id="@raindancers/raindancers-crew.CrewBackupBucket.grantRead"></a>

```typescript
public grantRead(grantee: IGrantable): void
```

Grant a principal permission to READ snapshots (and the KMS decrypt it needs).

Used by a replacement instance restoring from backup.

###### `grantee`<sup>Required</sup> <a name="grantee" id="@raindancers/raindancers-crew.CrewBackupBucket.grantRead.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

##### `grantWrite` <a name="grantWrite" id="@raindancers/raindancers-crew.CrewBackupBucket.grantWrite"></a>

```typescript
public grantWrite(grantee: IGrantable): void
```

Grant a principal permission to WRITE snapshots (and the KMS encrypt it needs).

Used by the crew instance/task role that pushes backups.

###### `grantee`<sup>Required</sup> <a name="grantee" id="@raindancers/raindancers-crew.CrewBackupBucket.grantWrite.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@raindancers/raindancers-crew.CrewBackupBucket.isConstruct"></a>

```typescript
import { CrewBackupBucket } from '@raindancers/raindancers-crew'

CrewBackupBucket.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@raindancers/raindancers-crew.CrewBackupBucket.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.property.bucket">bucket</a></code> | <code>aws-cdk-lib.aws_s3.IBucket</code> | The backup bucket. |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucket.property.key">key</a></code> | <code>aws-cdk-lib.aws_kms.Key</code> | The KMS key encrypting the bucket. |

---

##### `node`<sup>Required</sup> <a name="node" id="@raindancers/raindancers-crew.CrewBackupBucket.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `bucket`<sup>Required</sup> <a name="bucket" id="@raindancers/raindancers-crew.CrewBackupBucket.property.bucket"></a>

```typescript
public readonly bucket: IBucket;
```

- *Type:* aws-cdk-lib.aws_s3.IBucket

The backup bucket.

---

##### `key`<sup>Required</sup> <a name="key" id="@raindancers/raindancers-crew.CrewBackupBucket.property.key"></a>

```typescript
public readonly key: Key;
```

- *Type:* aws-cdk-lib.aws_kms.Key

The KMS key encrypting the bucket.

---


### CrewWebhookIngress <a name="CrewWebhookIngress" id="@raindancers/raindancers-crew.CrewWebhookIngress"></a>

OPTIONAL, composable webhook-ingress path for {@link EcsCrewHost}, mirroring the optional {@link CrewBackupBucket } shape.

Nothing is created unless the
consumer instantiates it, so an existing consumer gains no new resources.

Because each crew task runs in awsvpc mode with a real private VPC IP, an
in-VPC Lambda can POST to a crew's `POST /api/hooks/agent` DIRECTLY — no VPC
endpoint, no PrivateLink, no ALB. This construct wires: an SNS topic, an
in-VPC Lambda under the permissions boundary, and a scoped ingress rule on
the crew task security group from the Lambda's SG on the crew port ONLY.
That ingress rule is the single controlled inbound exception to the
egress-only task model.

Greenfield: the construct wires the plumbing but ships no webhook-to-crew
routing opinion — the consumer supplies the Lambda {@link CrewWebhookIngressProps.code}.

#### Initializers <a name="Initializers" id="@raindancers/raindancers-crew.CrewWebhookIngress.Initializer"></a>

```typescript
import { CrewWebhookIngress } from '@raindancers/raindancers-crew'

new CrewWebhookIngress(scope: Construct, id: string, props: CrewWebhookIngressProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.Initializer.parameter.props">props</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps">CrewWebhookIngressProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@raindancers/raindancers-crew.CrewWebhookIngress.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@raindancers/raindancers-crew.CrewWebhookIngress.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@raindancers/raindancers-crew.CrewWebhookIngress.Initializer.parameter.props"></a>

- *Type:* <a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps">CrewWebhookIngressProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="@raindancers/raindancers-crew.CrewWebhookIngress.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="@raindancers/raindancers-crew.CrewWebhookIngress.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="@raindancers/raindancers-crew.CrewWebhookIngress.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@raindancers/raindancers-crew.CrewWebhookIngress.isConstruct"></a>

```typescript
import { CrewWebhookIngress } from '@raindancers/raindancers-crew'

CrewWebhookIngress.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@raindancers/raindancers-crew.CrewWebhookIngress.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.property.function">function</a></code> | <code>aws-cdk-lib.aws_lambda.Function</code> | The in-VPC ingress Lambda. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.property.securityGroup">securityGroup</a></code> | <code>aws-cdk-lib.aws_ec2.SecurityGroup</code> | The ingress Lambda's security group (the source of the scoped task ingress rule). |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngress.property.topic">topic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | The SNS topic that fans events into the ingress Lambda. |

---

##### `node`<sup>Required</sup> <a name="node" id="@raindancers/raindancers-crew.CrewWebhookIngress.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `function`<sup>Required</sup> <a name="function" id="@raindancers/raindancers-crew.CrewWebhookIngress.property.function"></a>

```typescript
public readonly function: Function;
```

- *Type:* aws-cdk-lib.aws_lambda.Function

The in-VPC ingress Lambda.

---

##### `securityGroup`<sup>Required</sup> <a name="securityGroup" id="@raindancers/raindancers-crew.CrewWebhookIngress.property.securityGroup"></a>

```typescript
public readonly securityGroup: SecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.SecurityGroup

The ingress Lambda's security group (the source of the scoped task ingress rule).

---

##### `topic`<sup>Required</sup> <a name="topic" id="@raindancers/raindancers-crew.CrewWebhookIngress.property.topic"></a>

```typescript
public readonly topic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic

The SNS topic that fans events into the ingress Lambda.

---


### EcsCrewHost <a name="EcsCrewHost" id="@raindancers/raindancers-crew.EcsCrewHost"></a>

One self-provisioned EC2 host running the ECS agent, hosting `crewCount` Kiro Crew instances as ECS-on-EC2 container tasks.

The host registers to the {@link FargateCrewBase} cluster and does the NAT
for the crew tasks itself, so the tasks stay fully private with no public
IPs and no NAT Gateway, fck-nat, VPC endpoints, or ALB. Each task runs in
awsvpc mode with its own ENI and private VPC IP; each crew keeps its durable
`~/.kiro/crew` state on its own encrypted EBS volume that survives instance
replacement.

Isolation is container-level (shared kernel), accepted as sufficient:
Graviton Nitro protects the box from other AWS tenants, containers cover
crew-to-crew separation. See the host-OOM caution: hard per-task memory caps
bound each crew's ceiling but a busy crew can still pressure siblings when
the sum of actual usage exceeds physical RAM.

`crewCount` defaults to 1, identical to the single-crew shape, so a plain
instantiation with no new props gains no extra resources.

#### Initializers <a name="Initializers" id="@raindancers/raindancers-crew.EcsCrewHost.Initializer"></a>

```typescript
import { EcsCrewHost } from '@raindancers/raindancers-crew'

new EcsCrewHost(scope: Construct, id: string, props: EcsCrewHostProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.Initializer.parameter.props">props</a></code> | <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps">EcsCrewHostProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@raindancers/raindancers-crew.EcsCrewHost.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@raindancers/raindancers-crew.EcsCrewHost.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@raindancers/raindancers-crew.EcsCrewHost.Initializer.parameter.props"></a>

- *Type:* <a href="#@raindancers/raindancers-crew.EcsCrewHostProps">EcsCrewHostProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="@raindancers/raindancers-crew.EcsCrewHost.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="@raindancers/raindancers-crew.EcsCrewHost.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="@raindancers/raindancers-crew.EcsCrewHost.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@raindancers/raindancers-crew.EcsCrewHost.isConstruct"></a>

```typescript
import { EcsCrewHost } from '@raindancers/raindancers-crew'

EcsCrewHost.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@raindancers/raindancers-crew.EcsCrewHost.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.autoScalingGroup">autoScalingGroup</a></code> | <code>aws-cdk-lib.aws_autoscaling.AutoScalingGroup</code> | The size-1 Auto Scaling Group holding the single ECS-registered EC2 host. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.base">base</a></code> | <code><a href="#@raindancers/raindancers-crew.FargateCrewBase">FargateCrewBase</a></code> | The shared ECS scaffolding (cluster + egress-only task SG). |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.capacityProvider">capacityProvider</a></code> | <code>aws-cdk-lib.aws_ecs.AsgCapacityProvider</code> | The capacity provider registering the host with the cluster. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.crewNames">crewNames</a></code> | <code>string[]</code> | The resolved crew names. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.crews">crews</a></code> | <code><a href="#@raindancers/raindancers-crew.FargateCrew">FargateCrew</a>[]</code> | The per-crew scaffolding (roles + log group), one per crew. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.dataVolumes">dataVolumes</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewDataVolume">CrewDataVolume</a>[]</code> | The per-crew durable data volumes (device/label/mount metadata). |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.hostSecurityGroup">hostSecurityGroup</a></code> | <code>aws-cdk-lib.aws_ec2.SecurityGroup</code> | The host's SSM-only security group (no inbound). |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.region">region</a></code> | <code>string</code> | The region the host runs in (read from the stack env, never a prop). |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.role">role</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | The host instance's IAM role (carries the permissions boundary). |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.services">services</a></code> | <code>aws-cdk-lib.aws_ecs.Ec2Service[]</code> | The per-crew EC2 services. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHost.property.stackTag">stackTag</a></code> | <code>string</code> | The discovery tag value written as `kirocrew:ecs-host`. |

---

##### `node`<sup>Required</sup> <a name="node" id="@raindancers/raindancers-crew.EcsCrewHost.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `autoScalingGroup`<sup>Required</sup> <a name="autoScalingGroup" id="@raindancers/raindancers-crew.EcsCrewHost.property.autoScalingGroup"></a>

```typescript
public readonly autoScalingGroup: AutoScalingGroup;
```

- *Type:* aws-cdk-lib.aws_autoscaling.AutoScalingGroup

The size-1 Auto Scaling Group holding the single ECS-registered EC2 host.

---

##### `base`<sup>Required</sup> <a name="base" id="@raindancers/raindancers-crew.EcsCrewHost.property.base"></a>

```typescript
public readonly base: FargateCrewBase;
```

- *Type:* <a href="#@raindancers/raindancers-crew.FargateCrewBase">FargateCrewBase</a>

The shared ECS scaffolding (cluster + egress-only task SG).

---

##### `capacityProvider`<sup>Required</sup> <a name="capacityProvider" id="@raindancers/raindancers-crew.EcsCrewHost.property.capacityProvider"></a>

```typescript
public readonly capacityProvider: AsgCapacityProvider;
```

- *Type:* aws-cdk-lib.aws_ecs.AsgCapacityProvider

The capacity provider registering the host with the cluster.

---

##### `crewNames`<sup>Required</sup> <a name="crewNames" id="@raindancers/raindancers-crew.EcsCrewHost.property.crewNames"></a>

```typescript
public readonly crewNames: string[];
```

- *Type:* string[]

The resolved crew names.

---

##### `crews`<sup>Required</sup> <a name="crews" id="@raindancers/raindancers-crew.EcsCrewHost.property.crews"></a>

```typescript
public readonly crews: FargateCrew[];
```

- *Type:* <a href="#@raindancers/raindancers-crew.FargateCrew">FargateCrew</a>[]

The per-crew scaffolding (roles + log group), one per crew.

---

##### `dataVolumes`<sup>Required</sup> <a name="dataVolumes" id="@raindancers/raindancers-crew.EcsCrewHost.property.dataVolumes"></a>

```typescript
public readonly dataVolumes: CrewDataVolume[];
```

- *Type:* <a href="#@raindancers/raindancers-crew.CrewDataVolume">CrewDataVolume</a>[]

The per-crew durable data volumes (device/label/mount metadata).

---

##### `hostSecurityGroup`<sup>Required</sup> <a name="hostSecurityGroup" id="@raindancers/raindancers-crew.EcsCrewHost.property.hostSecurityGroup"></a>

```typescript
public readonly hostSecurityGroup: SecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.SecurityGroup

The host's SSM-only security group (no inbound).

---

##### `region`<sup>Required</sup> <a name="region" id="@raindancers/raindancers-crew.EcsCrewHost.property.region"></a>

```typescript
public readonly region: string;
```

- *Type:* string

The region the host runs in (read from the stack env, never a prop).

---

##### `role`<sup>Required</sup> <a name="role" id="@raindancers/raindancers-crew.EcsCrewHost.property.role"></a>

```typescript
public readonly role: Role;
```

- *Type:* aws-cdk-lib.aws_iam.Role

The host instance's IAM role (carries the permissions boundary).

---

##### `services`<sup>Required</sup> <a name="services" id="@raindancers/raindancers-crew.EcsCrewHost.property.services"></a>

```typescript
public readonly services: Ec2Service[];
```

- *Type:* aws-cdk-lib.aws_ecs.Ec2Service[]

The per-crew EC2 services.

---

##### `stackTag`<sup>Required</sup> <a name="stackTag" id="@raindancers/raindancers-crew.EcsCrewHost.property.stackTag"></a>

```typescript
public readonly stackTag: string;
```

- *Type:* string

The discovery tag value written as `kirocrew:ecs-host`.

---


### FargateCrew <a name="FargateCrew" id="@raindancers/raindancers-crew.FargateCrew"></a>

Per-crew Fargate scaffolding for ONE KiroCrew remote crew: the two roles a task carries and the log group it writes to.

One per crew, alongside the shared {@link FargateCrewBase }. Deleting this
removes exactly one crew's identity and logs and leaves the cluster and its
siblings untouched. Port of the upstream `kirocrew-fargate-crew` template.

Security invariants preserved from upstream:
- The **task role** (the running container's identity, and the blast radius
  one agent turn reaches) is created with NO policies and MUST NEVER be
  granted `secretsmanager:GetSecretValue` — the model credential is already
  in the container env, so the grant buys nothing while letting one turn read
  every crew's secret.
- The **execution role** reads secrets scoped to `kirocrew/crew/<crew>/*`
  only, with individually-listed actions (no prefix wildcards).
- Both assume-role policies carry an `aws:SourceAccount` condition so the
  roles are not assumable on behalf of an unrelated stack's task.

#### Initializers <a name="Initializers" id="@raindancers/raindancers-crew.FargateCrew.Initializer"></a>

```typescript
import { FargateCrew } from '@raindancers/raindancers-crew'

new FargateCrew(scope: Construct, id: string, props: FargateCrewProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.Initializer.parameter.props">props</a></code> | <code><a href="#@raindancers/raindancers-crew.FargateCrewProps">FargateCrewProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@raindancers/raindancers-crew.FargateCrew.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@raindancers/raindancers-crew.FargateCrew.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@raindancers/raindancers-crew.FargateCrew.Initializer.parameter.props"></a>

- *Type:* <a href="#@raindancers/raindancers-crew.FargateCrewProps">FargateCrewProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="@raindancers/raindancers-crew.FargateCrew.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="@raindancers/raindancers-crew.FargateCrew.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="@raindancers/raindancers-crew.FargateCrew.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@raindancers/raindancers-crew.FargateCrew.isConstruct"></a>

```typescript
import { FargateCrew } from '@raindancers/raindancers-crew'

FargateCrew.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@raindancers/raindancers-crew.FargateCrew.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.crew">crew</a></code> | <code>string</code> | The crew this construct scaffolds. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.executionRole">executionRole</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | Role ECS assumes BEFORE the container starts (secret fetch + log stream). |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.logGroup">logGroup</a></code> | <code>aws-cdk-lib.aws_logs.LogGroup</code> | The crew's log group (`/kirocrew/crew/<crew>`). |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.secretArnPattern">secretArnPattern</a></code> | <code>string</code> | The one secret ARN pattern the execution role may read. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.secretNamePrefix">secretNamePrefix</a></code> | <code>string</code> | Namespace a crew secret must be created under for the exec role to read it. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrew.property.taskRole">taskRole</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | Identity the RUNNING container carries. |

---

##### `node`<sup>Required</sup> <a name="node" id="@raindancers/raindancers-crew.FargateCrew.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `crew`<sup>Required</sup> <a name="crew" id="@raindancers/raindancers-crew.FargateCrew.property.crew"></a>

```typescript
public readonly crew: string;
```

- *Type:* string

The crew this construct scaffolds.

---

##### `executionRole`<sup>Required</sup> <a name="executionRole" id="@raindancers/raindancers-crew.FargateCrew.property.executionRole"></a>

```typescript
public readonly executionRole: Role;
```

- *Type:* aws-cdk-lib.aws_iam.Role

Role ECS assumes BEFORE the container starts (secret fetch + log stream).

---

##### `logGroup`<sup>Required</sup> <a name="logGroup" id="@raindancers/raindancers-crew.FargateCrew.property.logGroup"></a>

```typescript
public readonly logGroup: LogGroup;
```

- *Type:* aws-cdk-lib.aws_logs.LogGroup

The crew's log group (`/kirocrew/crew/<crew>`).

---

##### `secretArnPattern`<sup>Required</sup> <a name="secretArnPattern" id="@raindancers/raindancers-crew.FargateCrew.property.secretArnPattern"></a>

```typescript
public readonly secretArnPattern: string;
```

- *Type:* string

The one secret ARN pattern the execution role may read.

---

##### `secretNamePrefix`<sup>Required</sup> <a name="secretNamePrefix" id="@raindancers/raindancers-crew.FargateCrew.property.secretNamePrefix"></a>

```typescript
public readonly secretNamePrefix: string;
```

- *Type:* string

Namespace a crew secret must be created under for the exec role to read it.

---

##### `taskRole`<sup>Required</sup> <a name="taskRole" id="@raindancers/raindancers-crew.FargateCrew.property.taskRole"></a>

```typescript
public readonly taskRole: Role;
```

- *Type:* aws-cdk-lib.aws_iam.Role

Identity the RUNNING container carries.

Created with no policies.

---


### FargateCrewBase <a name="FargateCrewBase" id="@raindancers/raindancers-crew.FargateCrewBase"></a>

Shared Fargate scaffolding for KiroCrew remote crews: the ECS cluster every crew task runs on and the egress-only security group they are placed in.

ONE per account and region. The per-crew roles and log group live in
{@link FargateCrew } (one per crew), so deleting a crew cannot delete the
cluster its siblings run on.

Port of the upstream `kirocrew-fargate-base` CloudFormation template.

#### Initializers <a name="Initializers" id="@raindancers/raindancers-crew.FargateCrewBase.Initializer"></a>

```typescript
import { FargateCrewBase } from '@raindancers/raindancers-crew'

new FargateCrewBase(scope: Construct, id: string, props: FargateCrewBaseProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.Initializer.parameter.props">props</a></code> | <code><a href="#@raindancers/raindancers-crew.FargateCrewBaseProps">FargateCrewBaseProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@raindancers/raindancers-crew.FargateCrewBase.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@raindancers/raindancers-crew.FargateCrewBase.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@raindancers/raindancers-crew.FargateCrewBase.Initializer.parameter.props"></a>

- *Type:* <a href="#@raindancers/raindancers-crew.FargateCrewBaseProps">FargateCrewBaseProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="@raindancers/raindancers-crew.FargateCrewBase.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="@raindancers/raindancers-crew.FargateCrewBase.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="@raindancers/raindancers-crew.FargateCrewBase.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@raindancers/raindancers-crew.FargateCrewBase.isConstruct"></a>

```typescript
import { FargateCrewBase } from '@raindancers/raindancers-crew'

FargateCrewBase.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@raindancers/raindancers-crew.FargateCrewBase.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_ecs.Cluster</code> | The ECS cluster crew tasks run on. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.property.cpuArchitecture">cpuArchitecture</a></code> | <code><a href="#@raindancers/raindancers-crew.FargateCpuArchitecture">FargateCpuArchitecture</a></code> | The architecture crew images must be built for. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.property.securityGroup">securityGroup</a></code> | <code>aws-cdk-lib.aws_ec2.SecurityGroup</code> | The egress-only task security group (no inbound). |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBase.property.stackTag">stackTag</a></code> | <code>string</code> | The `kirocrew:fargate` discovery tag value. |

---

##### `node`<sup>Required</sup> <a name="node" id="@raindancers/raindancers-crew.FargateCrewBase.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="@raindancers/raindancers-crew.FargateCrewBase.property.cluster"></a>

```typescript
public readonly cluster: Cluster;
```

- *Type:* aws-cdk-lib.aws_ecs.Cluster

The ECS cluster crew tasks run on.

---

##### `cpuArchitecture`<sup>Required</sup> <a name="cpuArchitecture" id="@raindancers/raindancers-crew.FargateCrewBase.property.cpuArchitecture"></a>

```typescript
public readonly cpuArchitecture: FargateCpuArchitecture;
```

- *Type:* <a href="#@raindancers/raindancers-crew.FargateCpuArchitecture">FargateCpuArchitecture</a>

The architecture crew images must be built for.

---

##### `securityGroup`<sup>Required</sup> <a name="securityGroup" id="@raindancers/raindancers-crew.FargateCrewBase.property.securityGroup"></a>

```typescript
public readonly securityGroup: SecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.SecurityGroup

The egress-only task security group (no inbound).

---

##### `stackTag`<sup>Required</sup> <a name="stackTag" id="@raindancers/raindancers-crew.FargateCrewBase.property.stackTag"></a>

```typescript
public readonly stackTag: string;
```

- *Type:* string

The `kirocrew:fargate` discovery tag value.

---


### RemoteCrewInstance <a name="RemoteCrewInstance" id="@raindancers/raindancers-crew.RemoteCrewInstance"></a>

A self-hosted KiroCrew gateway on a single EC2 instance, reached over SSM Session Manager with no inbound ports.

This is a pipeline-native, version-controlled CDK port of the upstream
`kirocrew-ec2` CloudFormation template
(github.com/kirodotdev/KiroCrew). It provisions the same shape — an IAM
role (SSM core + optional scoped S3 read) under a required permissions
boundary, an SSM-only security group, an IMDSv2-enforced instance on an
encrypted gp3 volume, and a WaitCondition that blocks stack completion
until the gateway is serving — but under your naming, boundary, and
deploy pipeline instead of an imperative `kirocrew cloud launch`.

Access is via SSM port-forward only; the public DNS output is for
diagnostics.

#### Initializers <a name="Initializers" id="@raindancers/raindancers-crew.RemoteCrewInstance.Initializer"></a>

```typescript
import { RemoteCrewInstance } from '@raindancers/raindancers-crew'

new RemoteCrewInstance(scope: Construct, id: string, props: RemoteCrewInstanceProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.Initializer.parameter.props">props</a></code> | <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps">RemoteCrewInstanceProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="@raindancers/raindancers-crew.RemoteCrewInstance.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="@raindancers/raindancers-crew.RemoteCrewInstance.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="@raindancers/raindancers-crew.RemoteCrewInstance.Initializer.parameter.props"></a>

- *Type:* <a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps">RemoteCrewInstanceProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.with">with</a></code> | Applies one or more mixins to this construct. |

---

##### `toString` <a name="toString" id="@raindancers/raindancers-crew.RemoteCrewInstance.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `with` <a name="with" id="@raindancers/raindancers-crew.RemoteCrewInstance.with"></a>

```typescript
public with(mixins: ...IMixin[]): IConstruct
```

Applies one or more mixins to this construct.

Mixins are applied in order. The list of constructs is captured at the
start of the call, so constructs added by a mixin will not be visited.
Use multiple `with()` calls if subsequent mixins should apply to added
constructs.

###### `mixins`<sup>Required</sup> <a name="mixins" id="@raindancers/raindancers-crew.RemoteCrewInstance.with.parameter.mixins"></a>

- *Type:* ...constructs.IMixin[]

The mixins to apply.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="@raindancers/raindancers-crew.RemoteCrewInstance.isConstruct"></a>

```typescript
import { RemoteCrewInstance } from '@raindancers/raindancers-crew'

RemoteCrewInstance.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="@raindancers/raindancers-crew.RemoteCrewInstance.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.instance">instance</a></code> | <code>aws-cdk-lib.aws_ec2.Instance</code> | The EC2 instance (SSM target). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.instanceId">instanceId</a></code> | <code>string</code> | Instance id — the SSM target. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.publicDnsName">publicDnsName</a></code> | <code>string</code> | Public DNS of the instance (diagnostics only; |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.role">role</a></code> | <code>aws-cdk-lib.aws_iam.Role</code> | The instance's IAM role (carries the permissions boundary). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.securityGroup">securityGroup</a></code> | <code>aws-cdk-lib.aws_ec2.SecurityGroup</code> | The SSM-only security group (no inbound unless allowSshCidr is set). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstance.property.stackTag">stackTag</a></code> | <code>string</code> | The discovery tag value written as `kirocrew:instance`. |

---

##### `node`<sup>Required</sup> <a name="node" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `instance`<sup>Required</sup> <a name="instance" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.instance"></a>

```typescript
public readonly instance: Instance;
```

- *Type:* aws-cdk-lib.aws_ec2.Instance

The EC2 instance (SSM target).

---

##### `instanceId`<sup>Required</sup> <a name="instanceId" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.instanceId"></a>

```typescript
public readonly instanceId: string;
```

- *Type:* string

Instance id — the SSM target.

---

##### `publicDnsName`<sup>Required</sup> <a name="publicDnsName" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.publicDnsName"></a>

```typescript
public readonly publicDnsName: string;
```

- *Type:* string

Public DNS of the instance (diagnostics only;

access is via SSM).

---

##### `role`<sup>Required</sup> <a name="role" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.role"></a>

```typescript
public readonly role: Role;
```

- *Type:* aws-cdk-lib.aws_iam.Role

The instance's IAM role (carries the permissions boundary).

---

##### `securityGroup`<sup>Required</sup> <a name="securityGroup" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.securityGroup"></a>

```typescript
public readonly securityGroup: SecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.SecurityGroup

The SSM-only security group (no inbound unless allowSshCidr is set).

---

##### `stackTag`<sup>Required</sup> <a name="stackTag" id="@raindancers/raindancers-crew.RemoteCrewInstance.property.stackTag"></a>

```typescript
public readonly stackTag: string;
```

- *Type:* string

The discovery tag value written as `kirocrew:instance`.

---


## Structs <a name="Structs" id="Structs"></a>

### CrewBackupBucketProps <a name="CrewBackupBucketProps" id="@raindancers/raindancers-crew.CrewBackupBucketProps"></a>

Properties for {@link CrewBackupBucket}.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.CrewBackupBucketProps.Initializer"></a>

```typescript
import { CrewBackupBucketProps } from '@raindancers/raindancers-crew'

const crewBackupBucketProps: CrewBackupBucketProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucketProps.property.bucketName">bucketName</a></code> | <code>string</code> | Explicit bucket name. |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucketProps.property.noncurrentVersionExpirationDays">noncurrentVersionExpirationDays</a></code> | <code>number</code> | Days after which a NONCURRENT snapshot version is expired. |
| <code><a href="#@raindancers/raindancers-crew.CrewBackupBucketProps.property.removalPolicy">removalPolicy</a></code> | <code>aws-cdk-lib.RemovalPolicy</code> | What happens to the bucket when the stack is destroyed. |

---

##### `bucketName`<sup>Optional</sup> <a name="bucketName" id="@raindancers/raindancers-crew.CrewBackupBucketProps.property.bucketName"></a>

```typescript
public readonly bucketName: string;
```

- *Type:* string
- *Default:* CloudFormation-generated

Explicit bucket name.

Omit to let CloudFormation generate one.

---

##### `noncurrentVersionExpirationDays`<sup>Optional</sup> <a name="noncurrentVersionExpirationDays" id="@raindancers/raindancers-crew.CrewBackupBucketProps.property.noncurrentVersionExpirationDays"></a>

```typescript
public readonly noncurrentVersionExpirationDays: number;
```

- *Type:* number
- *Default:* 90

Days after which a NONCURRENT snapshot version is expired.

Current
versions are always kept. Set 0 to keep all versions forever.

---

##### `removalPolicy`<sup>Optional</sup> <a name="removalPolicy" id="@raindancers/raindancers-crew.CrewBackupBucketProps.property.removalPolicy"></a>

```typescript
public readonly removalPolicy: RemovalPolicy;
```

- *Type:* aws-cdk-lib.RemovalPolicy
- *Default:* RemovalPolicy.RETAIN

What happens to the bucket when the stack is destroyed.

Defaults to
RETAIN — the whole point is that the crew's learnings outlive the
instance, so the backup must outlive a stack teardown too.

---

### CrewDataVolume <a name="CrewDataVolume" id="@raindancers/raindancers-crew.CrewDataVolume"></a>

How a per-crew durable EBS volume is exposed to the host and its container.

The device name the construct asks for (for example `/dev/sdf`) is NOT the
kernel device name on Nitro/Graviton, where every EBS volume surfaces as an
unpredictable `/dev/nvmeXn1`. The bootstrap therefore resolves each volume by
a stable filesystem LABEL, never by the device path.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.CrewDataVolume.Initializer"></a>

```typescript
import { CrewDataVolume } from '@raindancers/raindancers-crew'

const crewDataVolume: CrewDataVolume = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewDataVolume.property.crew">crew</a></code> | <code>string</code> | The crew this volume belongs to. |
| <code><a href="#@raindancers/raindancers-crew.CrewDataVolume.property.deviceName">deviceName</a></code> | <code>string</code> | The block device name requested at attach time (a hint, not the kernel name). |
| <code><a href="#@raindancers/raindancers-crew.CrewDataVolume.property.label">label</a></code> | <code>string</code> | The stable filesystem label the bootstrap resolves and mounts by. |
| <code><a href="#@raindancers/raindancers-crew.CrewDataVolume.property.mountPath">mountPath</a></code> | <code>string</code> | The host mount path the container bind-mounts for `~/.kiro/crew`. |

---

##### `crew`<sup>Required</sup> <a name="crew" id="@raindancers/raindancers-crew.CrewDataVolume.property.crew"></a>

```typescript
public readonly crew: string;
```

- *Type:* string

The crew this volume belongs to.

---

##### `deviceName`<sup>Required</sup> <a name="deviceName" id="@raindancers/raindancers-crew.CrewDataVolume.property.deviceName"></a>

```typescript
public readonly deviceName: string;
```

- *Type:* string

The block device name requested at attach time (a hint, not the kernel name).

---

##### `label`<sup>Required</sup> <a name="label" id="@raindancers/raindancers-crew.CrewDataVolume.property.label"></a>

```typescript
public readonly label: string;
```

- *Type:* string

The stable filesystem label the bootstrap resolves and mounts by.

---

##### `mountPath`<sup>Required</sup> <a name="mountPath" id="@raindancers/raindancers-crew.CrewDataVolume.property.mountPath"></a>

```typescript
public readonly mountPath: string;
```

- *Type:* string

The host mount path the container bind-mounts for `~/.kiro/crew`.

---

### CrewRuntime <a name="CrewRuntime" id="@raindancers/raindancers-crew.CrewRuntime"></a>

Always-on runtime settings for the hosted crew, threaded into the crew `config.json` at boot. All fields are optional and default to the current gateway behaviour; omitting {@link RemoteCrewInstanceProps.crewRuntime} entirely reproduces today's `kirocrew setup --agent-only` + `kirocrew gateway` exactly.

Verified against KiroCrew v0.6.0: autopilot maps to `agent.approval_mode`,
idle-close maps to `session.timeout_secs`, and the conductor roster ships
with `setup --agent-only` (custom members are source-delivered JSON under
`~/.kiro/agents/`).

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.CrewRuntime.Initializer"></a>

```typescript
import { CrewRuntime } from '@raindancers/raindancers-crew'

const crewRuntime: CrewRuntime = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewRuntime.property.autopilot">autopilot</a></code> | <code>boolean</code> | Enable Autopilot: the hosted crew auto-approves tool calls that pass its security checks (deny rules and sensitive-path blocks still apply). |
| <code><a href="#@raindancers/raindancers-crew.CrewRuntime.property.disableIdleClose">disableIdleClose</a></code> | <code>boolean</code> | Keep the 24/7 brain session alive between events by disabling the idle session sweep. |

---

##### `autopilot`<sup>Optional</sup> <a name="autopilot" id="@raindancers/raindancers-crew.CrewRuntime.property.autopilot"></a>

```typescript
public readonly autopilot: boolean;
```

- *Type:* boolean
- *Default:* false (interactive; gateway default)

Enable Autopilot: the hosted crew auto-approves tool calls that pass its security checks (deny rules and sensitive-path blocks still apply).

Sets
`agent.approval_mode` to `"auto"` in config.json.

---

##### `disableIdleClose`<sup>Optional</sup> <a name="disableIdleClose" id="@raindancers/raindancers-crew.CrewRuntime.property.disableIdleClose"></a>

```typescript
public readonly disableIdleClose: boolean;
```

- *Type:* boolean
- *Default:* false (default 3600s idle timeout applies)

Keep the 24/7 brain session alive between events by disabling the idle session sweep.

Sets `session.timeout_secs` to `0` (documented: "0 disables
the idle sweep").

---

### CrewSource <a name="CrewSource" id="@raindancers/raindancers-crew.CrewSource"></a>

How the KiroCrew source is delivered to the instance at first boot.

Exactly one mode is active. When {@link sourceBucket} is set the instance
downloads a source tarball from S3 (and is granted read on just that one
object); otherwise it shallow-clones {@link kirocrewRef} from
{@link kirocrewRepo}.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.CrewSource.Initializer"></a>

```typescript
import { CrewSource } from '@raindancers/raindancers-crew'

const crewSource: CrewSource = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewSource.property.kirocrewRef">kirocrewRef</a></code> | <code>string</code> | Git ref (branch or tag) to install when cloning. |
| <code><a href="#@raindancers/raindancers-crew.CrewSource.property.kirocrewRepo">kirocrewRepo</a></code> | <code>string</code> | Git repository to clone when no S3 source is configured. |
| <code><a href="#@raindancers/raindancers-crew.CrewSource.property.sourceBucket">sourceBucket</a></code> | <code>string</code> | S3 bucket holding the source tarball (`kirocrew-src.tar.gz`). When set, the instance role is granted `s3:GetObject` on this object ONLY. Leave unset to clone from git instead. |
| <code><a href="#@raindancers/raindancers-crew.CrewSource.property.sourceKey">sourceKey</a></code> | <code>string</code> | S3 key of the source tarball within {@link sourceBucket}. |

---

##### `kirocrewRef`<sup>Optional</sup> <a name="kirocrewRef" id="@raindancers/raindancers-crew.CrewSource.property.kirocrewRef"></a>

```typescript
public readonly kirocrewRef: string;
```

- *Type:* string
- *Default:* 'main'

Git ref (branch or tag) to install when cloning.

Pin this to a released tag for reproducible, version-controlled deploys —
the upstream launcher defaults to `main`, which drifts. This construct
defaults to `main` only to match upstream; SET IT to a tag in production.

---

##### `kirocrewRepo`<sup>Optional</sup> <a name="kirocrewRepo" id="@raindancers/raindancers-crew.CrewSource.property.kirocrewRepo"></a>

```typescript
public readonly kirocrewRepo: string;
```

- *Type:* string
- *Default:* 'https://github.com/kirodotdev/KiroCrew.git'

Git repository to clone when no S3 source is configured.

---

##### `sourceBucket`<sup>Optional</sup> <a name="sourceBucket" id="@raindancers/raindancers-crew.CrewSource.property.sourceBucket"></a>

```typescript
public readonly sourceBucket: string;
```

- *Type:* string
- *Default:* clone from git (see kirocrewRepo / kirocrewRef)

S3 bucket holding the source tarball (`kirocrew-src.tar.gz`). When set, the instance role is granted `s3:GetObject` on this object ONLY. Leave unset to clone from git instead.

---

##### `sourceKey`<sup>Optional</sup> <a name="sourceKey" id="@raindancers/raindancers-crew.CrewSource.property.sourceKey"></a>

```typescript
public readonly sourceKey: string;
```

- *Type:* string
- *Default:* none

S3 key of the source tarball within {@link sourceBucket}.

Required when
`sourceBucket` is set; ignored otherwise.

---

### CrewWebhookIngressProps <a name="CrewWebhookIngressProps" id="@raindancers/raindancers-crew.CrewWebhookIngressProps"></a>

Properties for {@link CrewWebhookIngress}.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.Initializer"></a>

```typescript
import { CrewWebhookIngressProps } from '@raindancers/raindancers-crew'

const crewWebhookIngressProps: CrewWebhookIngressProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.code">code</a></code> | <code>aws-cdk-lib.aws_lambda.Code</code> | The code the ingress Lambda runs. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.host">host</a></code> | <code><a href="#@raindancers/raindancers-crew.EcsCrewHost">EcsCrewHost</a></code> | The crew host whose tasks receive webhooks. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.permissionsBoundaryArn">permissionsBoundaryArn</a></code> | <code>string</code> | ARN of an IAM permissions boundary applied to the Lambda's execution role. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | VPC to place the ingress Lambda in. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.architecture">architecture</a></code> | <code>aws-cdk-lib.aws_lambda.Architecture</code> | Lambda architecture. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.crewPort">crewPort</a></code> | <code>number</code> | TCP port on the crew task the Lambda reaches (the gateway/webhook port). |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.handler">handler</a></code> | <code>string</code> | The Lambda handler entry point. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.runtime">runtime</a></code> | <code>aws-cdk-lib.aws_lambda.Runtime</code> | The Lambda runtime. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.timeout">timeout</a></code> | <code>aws-cdk-lib.Duration</code> | Lambda timeout. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.topic">topic</a></code> | <code>aws-cdk-lib.aws_sns.ITopic</code> | An existing SNS topic to subscribe the Lambda to. |
| <code><a href="#@raindancers/raindancers-crew.CrewWebhookIngressProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnets to place the ingress Lambda's ENIs in. |

---

##### `code`<sup>Required</sup> <a name="code" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.code"></a>

```typescript
public readonly code: Code;
```

- *Type:* aws-cdk-lib.aws_lambda.Code

The code the ingress Lambda runs.

The consumer supplies it: this construct
wires the plumbing (SNS -> in-VPC Lambda -> task private IP) but does not
ship an opinion about how a webhook payload maps to a crew.

---

##### `host`<sup>Required</sup> <a name="host" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.host"></a>

```typescript
public readonly host: EcsCrewHost;
```

- *Type:* <a href="#@raindancers/raindancers-crew.EcsCrewHost">EcsCrewHost</a>

The crew host whose tasks receive webhooks.

The task security group is
granted a scoped inbound rule from this ingress Lambda's SG on the crew
port only — the one controlled inbound exception to the egress-only model.

---

##### `permissionsBoundaryArn`<sup>Required</sup> <a name="permissionsBoundaryArn" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.permissionsBoundaryArn"></a>

```typescript
public readonly permissionsBoundaryArn: string;
```

- *Type:* string

ARN of an IAM permissions boundary applied to the Lambda's execution role.

The ingress Lambda runs consumer-triggered code, so it carries a boundary
matching the rest of the construct.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

VPC to place the ingress Lambda in.

Must be the same VPC as the crew tasks
so the Lambda can reach a task's private ENI IP directly with NO VPC
endpoint.

---

##### `architecture`<sup>Optional</sup> <a name="architecture" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.architecture"></a>

```typescript
public readonly architecture: Architecture;
```

- *Type:* aws-cdk-lib.aws_lambda.Architecture
- *Default:* lambda.Architecture.ARM_64

Lambda architecture.

Defaults to arm64 to match the Graviton host.

---

##### `crewPort`<sup>Optional</sup> <a name="crewPort" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.crewPort"></a>

```typescript
public readonly crewPort: number;
```

- *Type:* number
- *Default:* 5476

TCP port on the crew task the Lambda reaches (the gateway/webhook port).

---

##### `handler`<sup>Optional</sup> <a name="handler" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.handler"></a>

```typescript
public readonly handler: string;
```

- *Type:* string
- *Default:* 'index.handler'

The Lambda handler entry point.

---

##### `runtime`<sup>Optional</sup> <a name="runtime" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.runtime"></a>

```typescript
public readonly runtime: Runtime;
```

- *Type:* aws-cdk-lib.aws_lambda.Runtime
- *Default:* lambda.Runtime.NODEJS_20_X

The Lambda runtime.

Must be an arm64-compatible runtime to match the
arm64 default host.

---

##### `timeout`<sup>Optional</sup> <a name="timeout" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.timeout"></a>

```typescript
public readonly timeout: Duration;
```

- *Type:* aws-cdk-lib.Duration
- *Default:* Duration.seconds(30)

Lambda timeout.

---

##### `topic`<sup>Optional</sup> <a name="topic" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.topic"></a>

```typescript
public readonly topic: ITopic;
```

- *Type:* aws-cdk-lib.aws_sns.ITopic
- *Default:* a new topic is created

An existing SNS topic to subscribe the Lambda to.

Omit to create one.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="@raindancers/raindancers-crew.CrewWebhookIngressProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* the VPC's private-with-egress subnets

Subnets to place the ingress Lambda's ENIs in.

Should be the same private
subnet the crew tasks run in so the Lambda reaches task IPs directly.

---

### EcsCrewHostProps <a name="EcsCrewHostProps" id="@raindancers/raindancers-crew.EcsCrewHostProps"></a>

Properties for {@link EcsCrewHost}.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.EcsCrewHostProps.Initializer"></a>

```typescript
import { EcsCrewHostProps } from '@raindancers/raindancers-crew'

const ecsCrewHostProps: EcsCrewHostProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.permissionsBoundaryArn">permissionsBoundaryArn</a></code> | <code>string</code> | ARN of an IAM permissions boundary applied to the host instance role. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | VPC to run in. Passed in, never created here. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.architecture">architecture</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewArchitecture">CrewArchitecture</a></code> | CPU architecture of the host and the crew container images. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.backupBucket">backupBucket</a></code> | <code><a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a></code> | An S3 backup bucket. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewCount">crewCount</a></code> | <code>number</code> | Number of Kiro Crew instances to host, each one ECS task/service. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewCpuShares">crewCpuShares</a></code> | <code>number</code> | Optional SOFT CPU shares per crew container (1024 = one vCPU). |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewDataVolumeSizeGb">crewDataVolumeSizeGb</a></code> | <code>number</code> | Per-crew durable EBS data volume size in GiB. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewDataVolumeType">crewDataVolumeType</a></code> | <code>aws-cdk-lib.aws_ec2.EbsDeviceVolumeType</code> | Per-crew EBS volume type. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewImage">crewImage</a></code> | <code>string</code> | Container image reference for the crew task. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewMemoryHardLimitMiB">crewMemoryHardLimitMiB</a></code> | <code>number</code> | HARD memory cap (MiB) per crew container. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewMemoryReservationMiB">crewMemoryReservationMiB</a></code> | <code>number</code> | SOFT memory reservation (MiB) per crew container. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crewPermissionsBoundaryArn">crewPermissionsBoundaryArn</a></code> | <code>string</code> | ARN of the pre-created shared crew permissions boundary (`arn:aws:iam::<account>:policy/kirocrew-crew-boundary`), applied to every per-crew task and execution role. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.crews">crews</a></code> | <code>string[]</code> | Explicit crew names. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.ecrRepositoryArn">ecrRepositoryArn</a></code> | <code>string</code> | ARN of the private ECR repository holding the crew image. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.hostSubnets">hostSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnet selection for the host ENI. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.instanceType">instanceType</a></code> | <code>aws-cdk-lib.aws_ec2.InstanceType</code> | EC2 instance type for the single ECS-registered host. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.logRetentionDays">logRetentionDays</a></code> | <code>number</code> | Days a crew's task logs are kept. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.rootVolumeSizeGb">rootVolumeSizeGb</a></code> | <code>number</code> | gp3 root volume size in GiB for the host. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.stackTag">stackTag</a></code> | <code>string</code> | Discovery tag value written as `kirocrew:ecs-host`. |
| <code><a href="#@raindancers/raindancers-crew.EcsCrewHostProps.property.taskSubnets">taskSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnet selection for the crew task ENIs. |

---

##### `permissionsBoundaryArn`<sup>Required</sup> <a name="permissionsBoundaryArn" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.permissionsBoundaryArn"></a>

```typescript
public readonly permissionsBoundaryArn: string;
```

- *Type:* string

ARN of an IAM permissions boundary applied to the host instance role.

The host runs a prompt-injectable agent per crew, so its role MUST carry a
boundary that caps blast radius. Required, not optional, matching
{@link RemoteCrewInstanceProps.permissionsBoundaryArn }. Any valid managed-
policy ARN is accepted here (this is the EC2/host boundary).

The per-crew task/execution roles take {@link crewPermissionsBoundaryArn},
which is validated separately against the `kirocrew-crew-boundary` pattern
the crew roles require.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

VPC to run in. Passed in, never created here.

The construct consumes a two-subnet host-NAT topology it does not build:
one PUBLIC subnet (host ENI + Elastic IP + IGW route) and one PRIVATE
subnet (task ENIs, `0.0.0.0/0` -> the host ENI, no IGW route). Select them
with {@link hostSubnets} and {@link taskSubnets}.

---

##### `architecture`<sup>Optional</sup> <a name="architecture" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.architecture"></a>

```typescript
public readonly architecture: CrewArchitecture;
```

- *Type:* <a href="#@raindancers/raindancers-crew.CrewArchitecture">CrewArchitecture</a>
- *Default:* CrewArchitecture.ARM64

CPU architecture of the host and the crew container images.

Must match
{@link instanceType} when that is set.

---

##### `backupBucket`<sup>Optional</sup> <a name="backupBucket" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.backupBucket"></a>

```typescript
public readonly backupBucket: ICrewBackupBucket;
```

- *Type:* <a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a>
- *Default:* no off-box backup

An S3 backup bucket.

When set, each per-crew TASK role is granted write so
the running container pushes its own snapshots off-box.

---

##### `crewCount`<sup>Optional</sup> <a name="crewCount" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewCount"></a>

```typescript
public readonly crewCount: number;
```

- *Type:* number
- *Default:* 1

Number of Kiro Crew instances to host, each one ECS task/service.

DEFAULT 1 — identical to today's single-crew behaviour, so existing
consumers gain nothing new. The 55minutes consumer passes 3. Validated
1..8: awsvpc gives each task its own ENI, and (crewCount + 1) ENIs (the
host ENI plus one per task) must fit the instance type's ENI budget.

---

##### `crewCpuShares`<sup>Optional</sup> <a name="crewCpuShares" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewCpuShares"></a>

```typescript
public readonly crewCpuShares: number;
```

- *Type:* number
- *Default:* unset (shared CPU)

Optional SOFT CPU shares per crew container (1024 = one vCPU).

Omit to
leave CPU unconstrained (crews share the host CPU fairly under contention).

---

##### `crewDataVolumeSizeGb`<sup>Optional</sup> <a name="crewDataVolumeSizeGb" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewDataVolumeSizeGb"></a>

```typescript
public readonly crewDataVolumeSizeGb: number;
```

- *Type:* number
- *Default:* 20

Per-crew durable EBS data volume size in GiB.

Always encrypted, always
`deleteOnTermination: false` (a crew's `~/.kiro/crew` learnings must
outlive an instance replacement, matching the CrewBackupBucket RETAIN
intent).

---

##### `crewDataVolumeType`<sup>Optional</sup> <a name="crewDataVolumeType" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewDataVolumeType"></a>

```typescript
public readonly crewDataVolumeType: EbsDeviceVolumeType;
```

- *Type:* aws-cdk-lib.aws_ec2.EbsDeviceVolumeType
- *Default:* ec2.EbsDeviceVolumeType.GP3

Per-crew EBS volume type.

---

##### `crewImage`<sup>Optional</sup> <a name="crewImage" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewImage"></a>

```typescript
public readonly crewImage: string;
```

- *Type:* string
- *Default:* 'public.ecr.aws/kirocrew/crew:latest'

Container image reference for the crew task.

When {@link ecrRepositoryArn}
is set this is typically the repo URI with a tag; otherwise a public
registry reference.

---

##### `crewMemoryHardLimitMiB`<sup>Optional</sup> <a name="crewMemoryHardLimitMiB" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewMemoryHardLimitMiB"></a>

```typescript
public readonly crewMemoryHardLimitMiB: number;
```

- *Type:* number
- *Default:* 2048

HARD memory cap (MiB) per crew container.

A crew is OOM-killed at this
ceiling, so no single crew can consume the whole host. Set the SUM of hard
caps at or below (physical RAM minus host + ECS-agent headroom) for a hard
cross-crew guarantee — see the host-OOM caution in the README.

---

##### `crewMemoryReservationMiB`<sup>Optional</sup> <a name="crewMemoryReservationMiB" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewMemoryReservationMiB"></a>

```typescript
public readonly crewMemoryReservationMiB: number;
```

- *Type:* number
- *Default:* 1024

SOFT memory reservation (MiB) per crew container.

ECS uses it for
placement; a crew may burst above it when the host has spare RAM, so idle
crews cost little.

---

##### `crewPermissionsBoundaryArn`<sup>Optional</sup> <a name="crewPermissionsBoundaryArn" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crewPermissionsBoundaryArn"></a>

```typescript
public readonly crewPermissionsBoundaryArn: string;
```

- *Type:* string
- *Default:* no crew boundary (declared degraded mode; see FargateCrew)

ARN of the pre-created shared crew permissions boundary (`arn:aws:iam::<account>:policy/kirocrew-crew-boundary`), applied to every per-crew task and execution role.

Separate from {@link permissionsBoundaryArn} because the crew roles enforce
the `kirocrew-crew-boundary` policy name (a different boundary from the
host's), and validating them together would force one ARN to satisfy two
distinct patterns. Optional, mirroring {@link FargateCrew}'s declared
degraded mode: omit it only when no crew-boundary creator exists yet.

---

##### `crews`<sup>Optional</sup> <a name="crews" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.crews"></a>

```typescript
public readonly crews: string[];
```

- *Type:* string[]
- *Default:* crew-1 .. crew-<crewCount>

Explicit crew names.

Each must match the {@link FargateCrew} regex
`^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`; the log group, roles, and secret
namespace are derived from it. When omitted, names are generated as
`crew-1`..`crew-<crewCount>`. When set, the list length must equal
{@link crewCount}.

---

##### `ecrRepositoryArn`<sup>Optional</sup> <a name="ecrRepositoryArn" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.ecrRepositoryArn"></a>

```typescript
public readonly ecrRepositoryArn: string;
```

- *Type:* string
- *Default:* public registry; no pull grant

ARN of the private ECR repository holding the crew image.

Leave unset when
the image is pulled from a public registry. When set, each per-crew
execution role gets a pull grant scoped to this one repository.

---

##### `hostSubnets`<sup>Optional</sup> <a name="hostSubnets" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.hostSubnets"></a>

```typescript
public readonly hostSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* one public subnet in the VPC

Subnet selection for the host ENI.

This is the PUBLIC subnet (IGW-routed,
carries the Elastic IP), because the host does the NAT for the tasks.

---

##### `instanceType`<sup>Optional</sup> <a name="instanceType" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.instanceType"></a>

```typescript
public readonly instanceType: InstanceType;
```

- *Type:* aws-cdk-lib.aws_ec2.InstanceType
- *Default:* m7g.2xlarge (arm64) / m7i.2xlarge (x86_64), matching RemoteCrewInstance

EC2 instance type for the single ECS-registered host.

The type STAYS a settable prop: the 55minutes consumer passes
`new ec2.InstanceType('m9g.xlarge')`. Never hardcoded to one family.

---

##### `logRetentionDays`<sup>Optional</sup> <a name="logRetentionDays" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.logRetentionDays"></a>

```typescript
public readonly logRetentionDays: number;
```

- *Type:* number
- *Default:* 30

Days a crew's task logs are kept.

One of the CloudWatch retention values
(see {@link FargateCrew}).

---

##### `rootVolumeSizeGb`<sup>Optional</sup> <a name="rootVolumeSizeGb" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.rootVolumeSizeGb"></a>

```typescript
public readonly rootVolumeSizeGb: number;
```

- *Type:* number
- *Default:* 60

gp3 root volume size in GiB for the host.

Always encrypted.

---

##### `stackTag`<sup>Optional</sup> <a name="stackTag" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.stackTag"></a>

```typescript
public readonly stackTag: string;
```

- *Type:* string
- *Default:* 'kirocrew'

Discovery tag value written as `kirocrew:ecs-host`.

Must match
`[a-zA-Z0-9-]{1,51}`. The cluster is named `kirocrew-crew-<stackTag>`.

---

##### `taskSubnets`<sup>Optional</sup> <a name="taskSubnets" id="@raindancers/raindancers-crew.EcsCrewHostProps.property.taskSubnets"></a>

```typescript
public readonly taskSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* the VPC's private-with-egress subnets

Subnet selection for the crew task ENIs.

This is the PRIVATE subnet whose
`0.0.0.0/0` route points at the host ENI (no IGW route). Tasks get no
public IP.

---

### FargateCrewBaseProps <a name="FargateCrewBaseProps" id="@raindancers/raindancers-crew.FargateCrewBaseProps"></a>

Properties for {@link FargateCrewBase}.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.FargateCrewBaseProps.Initializer"></a>

```typescript
import { FargateCrewBaseProps } from '@raindancers/raindancers-crew'

const fargateCrewBaseProps: FargateCrewBaseProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBaseProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | VPC the crew tasks are placed in. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBaseProps.property.cpuArchitecture">cpuArchitecture</a></code> | <code><a href="#@raindancers/raindancers-crew.FargateCpuArchitecture">FargateCpuArchitecture</a></code> | Architecture the crew image was built for. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBaseProps.property.stackTag">stackTag</a></code> | <code>string</code> | Discovery tag value written as `kirocrew:fargate`. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewBaseProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnets for the tasks' awsvpc network interfaces. |

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="@raindancers/raindancers-crew.FargateCrewBaseProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

VPC the crew tasks are placed in.

---

##### `cpuArchitecture`<sup>Optional</sup> <a name="cpuArchitecture" id="@raindancers/raindancers-crew.FargateCrewBaseProps.property.cpuArchitecture"></a>

```typescript
public readonly cpuArchitecture: FargateCpuArchitecture;
```

- *Type:* <a href="#@raindancers/raindancers-crew.FargateCpuArchitecture">FargateCpuArchitecture</a>
- *Default:* FargateCpuArchitecture.X86_64

Architecture the crew image was built for.

Surfaced as an output for the
launch spec so every placement field is read from a stack, not the
operator's memory.

---

##### `stackTag`<sup>Optional</sup> <a name="stackTag" id="@raindancers/raindancers-crew.FargateCrewBaseProps.property.stackTag"></a>

```typescript
public readonly stackTag: string;
```

- *Type:* string
- *Default:* 'kirocrew'

Discovery tag value written as `kirocrew:fargate`.

Must match
`[a-zA-Z0-9-]{1,51}`. The cluster is named `kirocrew-crew-<stackTag>`.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="@raindancers/raindancers-crew.FargateCrewBaseProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* the VPC's private-with-egress subnets

Subnets for the tasks' awsvpc network interfaces.

Each must be able to
reach the container registry — a NAT-routed private subnet, or a public
subnet with `assignPublicIp` at RunTask.

Networking is taken, never invented: whether egress is via NAT or a public
subnet is a property of the operator's VPC this construct cannot discover,
so it is passed in and echoed as an output for the launch spec.

---

### FargateCrewProps <a name="FargateCrewProps" id="@raindancers/raindancers-crew.FargateCrewProps"></a>

Properties for {@link FargateCrew}.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.FargateCrewProps.Initializer"></a>

```typescript
import { FargateCrewProps } from '@raindancers/raindancers-crew'

const fargateCrewProps: FargateCrewProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewProps.property.crew">crew</a></code> | <code>string</code> | Crew name: 1–32 chars, lower-case alphanumeric with inner hyphens, never leading or trailing. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewProps.property.backupBucket">backupBucket</a></code> | <code><a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a></code> | An S3 backup bucket to grant the TASK role write access to, so the running crew container can push `kirocrew snapshot` bundles off-box on its own schedule. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewProps.property.ecrRepositoryArn">ecrRepositoryArn</a></code> | <code>string</code> | ARN of the private ECR repository holding the crew image. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewProps.property.logRetentionDays">logRetentionDays</a></code> | <code>number</code> | Days a crew's task logs are kept before CloudWatch expires them. |
| <code><a href="#@raindancers/raindancers-crew.FargateCrewProps.property.permissionsBoundaryArn">permissionsBoundaryArn</a></code> | <code>string</code> | ARN of the pre-created shared crew permissions boundary (`arn:aws:iam::<account>:policy/kirocrew-crew-boundary`). |

---

##### `crew`<sup>Required</sup> <a name="crew" id="@raindancers/raindancers-crew.FargateCrewProps.property.crew"></a>

```typescript
public readonly crew: string;
```

- *Type:* string

Crew name: 1–32 chars, lower-case alphanumeric with inner hyphens, never leading or trailing.

Every resource name is DERIVED from it — the task
definition rebuilds the role ARNs and log-group name from the crew name
and refuses a document whose ARNs disagree, so a rename here is a launch
refusal, not a silent mismatch.

---

##### `backupBucket`<sup>Optional</sup> <a name="backupBucket" id="@raindancers/raindancers-crew.FargateCrewProps.property.backupBucket"></a>

```typescript
public readonly backupBucket: ICrewBackupBucket;
```

- *Type:* <a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a>
- *Default:* no off-box backup grant

An S3 backup bucket to grant the TASK role write access to, so the running crew container can push `kirocrew snapshot` bundles off-box on its own schedule.

The task role (not the execution role) gets this, because the
push runs inside the container. Omit to disable off-box backup.

---

##### `ecrRepositoryArn`<sup>Optional</sup> <a name="ecrRepositoryArn" id="@raindancers/raindancers-crew.FargateCrewProps.property.ecrRepositoryArn"></a>

```typescript
public readonly ecrRepositoryArn: string;
```

- *Type:* string
- *Default:* public registry; no pull grant

ARN of the private ECR repository holding the crew image.

Leave unset when
the image is pulled from a public registry (the decided delivery, ECR
Public), which needs no execution-role pull grant. When set, the pull grant
is scoped to this one repository.

---

##### `logRetentionDays`<sup>Optional</sup> <a name="logRetentionDays" id="@raindancers/raindancers-crew.FargateCrewProps.property.logRetentionDays"></a>

```typescript
public readonly logRetentionDays: number;
```

- *Type:* number
- *Default:* 30

Days a crew's task logs are kept before CloudWatch expires them.

Must be
one of the CloudWatch retention values.

---

##### `permissionsBoundaryArn`<sup>Optional</sup> <a name="permissionsBoundaryArn" id="@raindancers/raindancers-crew.FargateCrewProps.property.permissionsBoundaryArn"></a>

```typescript
public readonly permissionsBoundaryArn: string;
```

- *Type:* string
- *Default:* no boundary (declared degraded mode)

ARN of the pre-created shared crew permissions boundary (`arn:aws:iam::<account>:policy/kirocrew-crew-boundary`).

Optional by design: this is a DECLARED degraded mode. Unlike the EC2 lane
(whose boundary is created once by launcher code), no creator exists for
the crew boundary yet, so rather than reference a policy nothing creates
this is omitted until that creator lands. When set, it caps what these
roles can ever do regardless of attached policies.

---

### RemoteCrewInstanceProps <a name="RemoteCrewInstanceProps" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps"></a>

Properties for {@link RemoteCrewInstance }.

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.Initializer"></a>

```typescript
import { RemoteCrewInstanceProps } from '@raindancers/raindancers-crew'

const remoteCrewInstanceProps: RemoteCrewInstanceProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.permissionsBoundaryArn">permissionsBoundaryArn</a></code> | <code>string</code> | ARN of an IAM permissions boundary applied to the instance role. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | VPC to launch the instance into. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.allowSshCidr">allowSshCidr</a></code> | <code>string</code> | Optional SSH ingress CIDR. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.architecture">architecture</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewArchitecture">CrewArchitecture</a></code> | CPU architecture. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.associatePublicIp">associatePublicIp</a></code> | <code>boolean</code> | Attach a public IP to the instance ENI. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.backupBucket">backupBucket</a></code> | <code><a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a></code> | An S3 backup bucket to push crew snapshots to on a schedule. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.backupPrefix">backupPrefix</a></code> | <code>string</code> | S3 key prefix under which snapshots are stored in the backup bucket. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.backupSchedule">backupSchedule</a></code> | <code>string</code> | systemd OnCalendar expression for the backup timer (see `man systemd.time`). Only used when {@link backupBucket} is set. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.bootstrapTimeoutMinutes">bootstrapTimeoutMinutes</a></code> | <code>number</code> | Minutes to wait for the gateway to become healthy before the stack fails and rolls back (cold boot + dnf + Node + vite build + pip). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.crewRuntime">crewRuntime</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewRuntime">CrewRuntime</a></code> | Always-on runtime settings (Autopilot, no-idle-close) for the hosted crew, threaded into config.json at boot. Omit for the current gateway defaults. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.dashboardPort">dashboardPort</a></code> | <code>number</code> | TCP port the gateway serves the dashboard on (loopback only; |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.enableIpv6">enableIpv6</a></code> | <code>boolean</code> | Assign an IPv6 address to the instance's primary ENI and permit IPv6 egress on the security group. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.instanceType">instanceType</a></code> | <code>aws-cdk-lib.aws_ec2.InstanceType</code> | EC2 instance type. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.source">source</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewSource">CrewSource</a></code> | How the KiroCrew source reaches the instance (S3 tarball or git clone). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.stackTag">stackTag</a></code> | <code>string</code> | Discovery tag value written as `kirocrew:instance`. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.volumeSizeGb">volumeSizeGb</a></code> | <code>number</code> | gp3 root volume size in GiB (20–1000). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnet selection for the instance. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.webhookIngress">webhookIngress</a></code> | <code><a href="#@raindancers/raindancers-crew.WebhookIngress">WebhookIngress</a></code> | Open the gateway/webhook port to ONE source security group only (never a CIDR). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.webhookTokenSecretArn">webhookTokenSecretArn</a></code> | <code>string</code> | Secrets Manager ARN of the Bearer token that authenticates the native webhook (`POST /api/hooks/agent`). |

---

##### `permissionsBoundaryArn`<sup>Required</sup> <a name="permissionsBoundaryArn" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.permissionsBoundaryArn"></a>

```typescript
public readonly permissionsBoundaryArn: string;
```

- *Type:* string

ARN of an IAM permissions boundary applied to the instance role.

The instance runs a prompt-injectable agent that executes arbitrary
tools, so its role MUST carry a boundary that caps blast radius. This is
required, not optional.

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

VPC to launch the instance into.

---

##### `allowSshCidr`<sup>Optional</sup> <a name="allowSshCidr" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.allowSshCidr"></a>

```typescript
public readonly allowSshCidr: string;
```

- *Type:* string
- *Default:* no inbound; SSM-only

Optional SSH ingress CIDR.

When set (and no wider than /16), opens tcp/22
from that CIDR as a fallback. Omit for SSM-only access (recommended).

---

##### `architecture`<sup>Optional</sup> <a name="architecture" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.architecture"></a>

```typescript
public readonly architecture: CrewArchitecture;
```

- *Type:* <a href="#@raindancers/raindancers-crew.CrewArchitecture">CrewArchitecture</a>
- *Default:* CrewArchitecture.ARM64

CPU architecture.

Must match {@link instanceType} when that is set.

---

##### `associatePublicIp`<sup>Optional</sup> <a name="associatePublicIp" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.associatePublicIp"></a>

```typescript
public readonly associatePublicIp: boolean;
```

- *Type:* boolean
- *Default:* true

Attach a public IP to the instance ENI.

Required for egress on IGW-only
subnets; leave off (false) for NAT-routed private subnets, where it is
unused attack surface.

---

##### `backupBucket`<sup>Optional</sup> <a name="backupBucket" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.backupBucket"></a>

```typescript
public readonly backupBucket: ICrewBackupBucket;
```

- *Type:* <a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a>
- *Default:* no off-box backup

An S3 backup bucket to push crew snapshots to on a schedule.

When set, the
instance role is granted write, a systemd timer runs
`kirocrew snapshot --purpose backup` and uploads the newest (redaction-
scrubbed) bundle, and a `kirocrew-restore-from-s3` helper is installed for
rebuilding a replacement instance. Omit to disable off-box backup.

---

##### `backupPrefix`<sup>Optional</sup> <a name="backupPrefix" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.backupPrefix"></a>

```typescript
public readonly backupPrefix: string;
```

- *Type:* string
- *Default:* 'crew-snapshots/'

S3 key prefix under which snapshots are stored in the backup bucket.

Only used when {@link backupBucket} is set. A trailing slash is added if
absent.

---

##### `backupSchedule`<sup>Optional</sup> <a name="backupSchedule" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.backupSchedule"></a>

```typescript
public readonly backupSchedule: string;
```

- *Type:* string
- *Default:* 'daily'

systemd OnCalendar expression for the backup timer (see `man systemd.time`). Only used when {@link backupBucket} is set.

---

##### `bootstrapTimeoutMinutes`<sup>Optional</sup> <a name="bootstrapTimeoutMinutes" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.bootstrapTimeoutMinutes"></a>

```typescript
public readonly bootstrapTimeoutMinutes: number;
```

- *Type:* number
- *Default:* 25

Minutes to wait for the gateway to become healthy before the stack fails and rolls back (cold boot + dnf + Node + vite build + pip).

---

##### `crewRuntime`<sup>Optional</sup> <a name="crewRuntime" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.crewRuntime"></a>

```typescript
public readonly crewRuntime: CrewRuntime;
```

- *Type:* <a href="#@raindancers/raindancers-crew.CrewRuntime">CrewRuntime</a>
- *Default:* current gateway behaviour (interactive, 3600s idle timeout)

Always-on runtime settings (Autopilot, no-idle-close) for the hosted crew, threaded into config.json at boot. Omit for the current gateway defaults.

---

##### `dashboardPort`<sup>Optional</sup> <a name="dashboardPort" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.dashboardPort"></a>

```typescript
public readonly dashboardPort: number;
```

- *Type:* number
- *Default:* 5476

TCP port the gateway serves the dashboard on (loopback only;

reached via
SSM port-forward). Recorded in the instance registry as the remote port.

---

##### `enableIpv6`<sup>Optional</sup> <a name="enableIpv6" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.enableIpv6"></a>

```typescript
public readonly enableIpv6: boolean;
```

- *Type:* boolean
- *Default:* false

Assign an IPv6 address to the instance's primary ENI and permit IPv6 egress on the security group.

Enables a dual-stack posture: combined with `associatePublicIp: false` and
a private, IPv6-capable subnet, the instance egresses over IPv6 (via the
VPC's Egress-Only Internet Gateway) with no public IPv4. CDK's
`allowAllOutbound` renders IPv4 `0.0.0.0/0` egress only, so this also adds
an explicit all-traffic IPv6 egress rule.

This construct does NOT provision subnet IPv6 CIDRs, an Egress-Only
Internet Gateway, or any route — those are the consumer VPC's
responsibility. The selected subnet(s) MUST already carry IPv6 CIDRs.

---

##### `instanceType`<sup>Optional</sup> <a name="instanceType" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.instanceType"></a>

```typescript
public readonly instanceType: InstanceType;
```

- *Type:* aws-cdk-lib.aws_ec2.InstanceType
- *Default:* m7g.2xlarge (arm64) / m7i.2xlarge (x86_64), matching the upstream "Development" size tier

EC2 instance type.

---

##### `source`<sup>Optional</sup> <a name="source" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.source"></a>

```typescript
public readonly source: CrewSource;
```

- *Type:* <a href="#@raindancers/raindancers-crew.CrewSource">CrewSource</a>
- *Default:* clone kirodotdev/KiroCrew@main

How the KiroCrew source reaches the instance (S3 tarball or git clone).

---

##### `stackTag`<sup>Optional</sup> <a name="stackTag" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.stackTag"></a>

```typescript
public readonly stackTag: string;
```

- *Type:* string
- *Default:* 'kirocrew'

Discovery tag value written as `kirocrew:instance`.

Must match
`[a-zA-Z0-9-]{1,51}`.

---

##### `volumeSizeGb`<sup>Optional</sup> <a name="volumeSizeGb" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.volumeSizeGb"></a>

```typescript
public readonly volumeSizeGb: number;
```

- *Type:* number
- *Default:* 60

gp3 root volume size in GiB (20–1000).

The volume is always encrypted.

---

##### `vpcSubnets`<sup>Optional</sup> <a name="vpcSubnets" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.vpcSubnets"></a>

```typescript
public readonly vpcSubnets: SubnetSelection;
```

- *Type:* aws-cdk-lib.aws_ec2.SubnetSelection
- *Default:* one public subnet in the VPC

Subnet selection for the instance.

A public (IGW-routed) subnet needs a
public IP for egress; a private (NAT-routed) subnet does not — see
{@link associatePublicIp}.

---

##### `webhookIngress`<sup>Optional</sup> <a name="webhookIngress" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.webhookIngress"></a>

```typescript
public readonly webhookIngress: WebhookIngress;
```

- *Type:* <a href="#@raindancers/raindancers-crew.WebhookIngress">WebhookIngress</a>
- *Default:* no webhook ingress

Open the gateway/webhook port to ONE source security group only (never a CIDR).

Independent of {@link allowSshCidr} — both, either, or neither may
be set; unset leaves the SG no-inbound (the default).

---

##### `webhookTokenSecretArn`<sup>Optional</sup> <a name="webhookTokenSecretArn" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.webhookTokenSecretArn"></a>

```typescript
public readonly webhookTokenSecretArn: string;
```

- *Type:* string
- *Default:* webhook auth not configured (loopback / SSM only)

Secrets Manager ARN of the Bearer token that authenticates the native webhook (`POST /api/hooks/agent`).

At boot the instance fetches the secret
and writes it as `hooks.webhook_token` in the crew `config.json` — the
token is never baked into userData, env literals, or code. The instance
role is granted `secretsmanager:GetSecretValue` on THIS ARN only.

Required when {@link webhookIngress} is set: a reachable webhook with no
auth is a defect, not a default, so synth fails if ingress is opened
without a token.

NOTE: the KiroCrew gateway binds loopback (`127.0.0.1`) only and exposes no
routable webhook listener — see the webhook Decisions-for-review in the PR.
This wires the AUTH (token-in-config); routable exposure of the loopback
route is a consumer reverse-proxy / tunnel concern.

---

### WebhookIngress <a name="WebhookIngress" id="@raindancers/raindancers-crew.WebhookIngress"></a>

Exposes the gateway's webhook port to ONE source security group.

There is deliberately no CIDR form: the brain box is never internet-
reachable by contract. The named source SG (e.g. an ingest Lambda's SG, or a
reverse proxy that fronts the loopback gateway) is the only peer allowed to
reach the port.

NOTE: the KiroCrew gateway binds loopback (`127.0.0.1`) only — it exposes no
routable listener. This rule opens the security group so a consumer-owned
reverse proxy / tunnel on the box can be reached from the source SG; actually
serving the webhook on a routable interface is the consumer's concern (see
README "Private dual-stack brain" and the webhook Decisions-for-review).

#### Initializer <a name="Initializer" id="@raindancers/raindancers-crew.WebhookIngress.Initializer"></a>

```typescript
import { WebhookIngress } from '@raindancers/raindancers-crew'

const webhookIngress: WebhookIngress = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.WebhookIngress.property.source">source</a></code> | <code>aws-cdk-lib.aws_ec2.ISecurityGroup</code> | Imported security group allowed to reach the webhook port. |
| <code><a href="#@raindancers/raindancers-crew.WebhookIngress.property.port">port</a></code> | <code>number</code> | TCP port the ingress rule opens. |

---

##### `source`<sup>Required</sup> <a name="source" id="@raindancers/raindancers-crew.WebhookIngress.property.source"></a>

```typescript
public readonly source: ISecurityGroup;
```

- *Type:* aws-cdk-lib.aws_ec2.ISecurityGroup

Imported security group allowed to reach the webhook port.

Passed as an
`ISecurityGroup` (imported) — this construct never creates it.

---

##### `port`<sup>Optional</sup> <a name="port" id="@raindancers/raindancers-crew.WebhookIngress.property.port"></a>

```typescript
public readonly port: number;
```

- *Type:* number
- *Default:* the resolved dashboardPort (5476)

TCP port the ingress rule opens.

Defaults to the dashboard/gateway port so
a reverse proxy fronting the loopback gateway is reachable; override to
target a consumer proxy on a different port.

---


## Protocols <a name="Protocols" id="Protocols"></a>

### ICrewBackupBucket <a name="ICrewBackupBucket" id="@raindancers/raindancers-crew.ICrewBackupBucket"></a>

- *Implemented By:* <a href="#@raindancers/raindancers-crew.CrewBackupBucket">CrewBackupBucket</a>, <a href="#@raindancers/raindancers-crew.ICrewBackupBucket">ICrewBackupBucket</a>

The subset of {@link CrewBackupBucket } the EC2/Fargate constructs need.

Kept
as an interface so a consumer can pass their own bucket wrapper.

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.ICrewBackupBucket.grantRead">grantRead</a></code> | Grant a principal read access to snapshots (bucket + KMS). |
| <code><a href="#@raindancers/raindancers-crew.ICrewBackupBucket.grantWrite">grantWrite</a></code> | Grant a principal write access to snapshots (bucket + KMS). |

---

##### `grantRead` <a name="grantRead" id="@raindancers/raindancers-crew.ICrewBackupBucket.grantRead"></a>

```typescript
public grantRead(grantee: IGrantable): void
```

Grant a principal read access to snapshots (bucket + KMS).

###### `grantee`<sup>Required</sup> <a name="grantee" id="@raindancers/raindancers-crew.ICrewBackupBucket.grantRead.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

##### `grantWrite` <a name="grantWrite" id="@raindancers/raindancers-crew.ICrewBackupBucket.grantWrite"></a>

```typescript
public grantWrite(grantee: IGrantable): void
```

Grant a principal write access to snapshots (bucket + KMS).

###### `grantee`<sup>Required</sup> <a name="grantee" id="@raindancers/raindancers-crew.ICrewBackupBucket.grantWrite.parameter.grantee"></a>

- *Type:* aws-cdk-lib.aws_iam.IGrantable

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#@raindancers/raindancers-crew.ICrewBackupBucket.property.bucket">bucket</a></code> | <code>aws-cdk-lib.aws_s3.IBucket</code> | The destination bucket name. |

---

##### `bucket`<sup>Required</sup> <a name="bucket" id="@raindancers/raindancers-crew.ICrewBackupBucket.property.bucket"></a>

```typescript
public readonly bucket: IBucket;
```

- *Type:* aws-cdk-lib.aws_s3.IBucket

The destination bucket name.

---

## Enums <a name="Enums" id="Enums"></a>

### CrewArchitecture <a name="CrewArchitecture" id="@raindancers/raindancers-crew.CrewArchitecture"></a>

CPU architecture for the KiroCrew EC2 instance.

Selects the matching
Amazon Linux 2023 AMI and the pinned Node.js / kiro-cli download.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.CrewArchitecture.ARM64">ARM64</a></code> | 64-bit ARM (Graviton). |
| <code><a href="#@raindancers/raindancers-crew.CrewArchitecture.X86_64">X86_64</a></code> | 64-bit x86. |

---

##### `ARM64` <a name="ARM64" id="@raindancers/raindancers-crew.CrewArchitecture.ARM64"></a>

64-bit ARM (Graviton).

The upstream default.

---


##### `X86_64` <a name="X86_64" id="@raindancers/raindancers-crew.CrewArchitecture.X86_64"></a>

64-bit x86.

---


### FargateCpuArchitecture <a name="FargateCpuArchitecture" id="@raindancers/raindancers-crew.FargateCpuArchitecture"></a>

CPU architecture a crew container image was built for.

Must match the image:
a task whose runtime platform disagrees with its image fails at start.

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#@raindancers/raindancers-crew.FargateCpuArchitecture.X86_64">X86_64</a></code> | *No description.* |
| <code><a href="#@raindancers/raindancers-crew.FargateCpuArchitecture.ARM64">ARM64</a></code> | *No description.* |

---

##### `X86_64` <a name="X86_64" id="@raindancers/raindancers-crew.FargateCpuArchitecture.X86_64"></a>

---


##### `ARM64` <a name="ARM64" id="@raindancers/raindancers-crew.FargateCpuArchitecture.ARM64"></a>

---

