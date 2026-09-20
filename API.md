# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

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
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.bootstrapTimeoutMinutes">bootstrapTimeoutMinutes</a></code> | <code>number</code> | Minutes to wait for the gateway to become healthy before the stack fails and rolls back (cold boot + dnf + Node + vite build + pip). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.dashboardPort">dashboardPort</a></code> | <code>number</code> | TCP port the gateway serves the dashboard on (loopback only; |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.instanceType">instanceType</a></code> | <code>aws-cdk-lib.aws_ec2.InstanceType</code> | EC2 instance type. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.source">source</a></code> | <code><a href="#@raindancers/raindancers-crew.CrewSource">CrewSource</a></code> | How the KiroCrew source reaches the instance (S3 tarball or git clone). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.stackTag">stackTag</a></code> | <code>string</code> | Discovery tag value written as `kirocrew:instance`. |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.volumeSizeGb">volumeSizeGb</a></code> | <code>number</code> | gp3 root volume size in GiB (20–1000). |
| <code><a href="#@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.vpcSubnets">vpcSubnets</a></code> | <code>aws-cdk-lib.aws_ec2.SubnetSelection</code> | Subnet selection for the instance. |

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

##### `bootstrapTimeoutMinutes`<sup>Optional</sup> <a name="bootstrapTimeoutMinutes" id="@raindancers/raindancers-crew.RemoteCrewInstanceProps.property.bootstrapTimeoutMinutes"></a>

```typescript
public readonly bootstrapTimeoutMinutes: number;
```

- *Type:* number
- *Default:* 25

Minutes to wait for the gateway to become healthy before the stack fails and rolls back (cold boot + dnf + Node + vite build + pip).

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

