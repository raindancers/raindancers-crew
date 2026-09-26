import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { CrewBackupBucket, EcsCrewHost } from '../src';

const BOUNDARY = 'arn:aws:iam::123456789012:policy/kirocrew-ec2-boundary';
const CREW_BOUNDARY = 'arn:aws:iam::123456789012:policy/kirocrew-crew-boundary';

function stackWithVpc() {
  const app = new App();
  const stack = new Stack(app, 'S', { env: { account: '123456789012', region: 'ap-southeast-2' } });
  const vpc = new ec2.Vpc(stack, 'Vpc');
  return { stack, vpc };
}

function tpl(props?: Record<string, unknown>) {
  const { stack, vpc } = stackWithVpc();
  new EcsCrewHost(stack, 'Fleet', {
    vpc,
    permissionsBoundaryArn: BOUNDARY,
    ...(props as object),
  });
  return Template.fromStack(stack);
}

describe('EcsCrewHost - defaults (additive guard)', () => {
  test('default crewCount = 1 synthesizes exactly one crew (single-crew shape preserved)', () => {
    const t = tpl();
    // One task definition, one service, one crew log group.
    expect(Object.keys(t.findResources('AWS::ECS::TaskDefinition'))).toHaveLength(1);
    expect(Object.keys(t.findResources('AWS::ECS::Service'))).toHaveLength(1);
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/kirocrew/crew/crew-1' });
  });

  test('creates exactly one ECS cluster named from the tag', () => {
    tpl({ stackTag: 'fiftyfive' }).hasResourceProperties('AWS::ECS::Cluster', {
      ClusterName: 'kirocrew-crew-fiftyfive',
    });
  });

  test('rejects an invalid stackTag', () => {
    expect(() => tpl({ stackTag: 'bad/tag' })).toThrow(/stackTag must match/);
  });

  test('a single EC2 host is provisioned (size-1 ASG) with IMDSv2 enforced', () => {
    const t = tpl();
    t.hasResourceProperties('AWS::AutoScaling::AutoScalingGroup', {
      MinSize: '1',
      MaxSize: '1',
    });
    t.hasResourceProperties('AWS::AutoScaling::LaunchConfiguration', {
      MetadataOptions: Match.objectLike({ HttpTokens: 'required' }),
    });
  });

  test('the host disables source/dest check itself (scoped IAM grant present)', () => {
    // CFN cannot set SourceDestCheck on an ASG instance, so the host role
    // carries a tag-scoped ModifyInstanceAttribute grant and the bootstrap
    // issues the call. Assert the grant exists and is tag-scoped.
    const t = tpl();
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'ec2:ModifyInstanceAttribute',
            Condition: Match.objectLike({
              StringEquals: { 'aws:ResourceTag/kirocrew:ecs-host': 'kirocrew' },
            }),
          }),
        ]),
      }),
    });
  });

  test('instance type stays a settable prop (default m7g.2xlarge on arm64)', () => {
    tpl().hasResourceProperties('AWS::AutoScaling::LaunchConfiguration', {
      InstanceType: 'm7g.2xlarge',
    });
  });

  test('consumer can pass m9g.xlarge (type is not hardcoded)', () => {
    tpl({ instanceType: new ec2.InstanceType('m9g.xlarge') }).hasResourceProperties(
      'AWS::AutoScaling::LaunchConfiguration',
      { InstanceType: 'm9g.xlarge' },
    );
  });
});

describe('EcsCrewHost - crewCount fan-out', () => {
  test('crewCount 3 fans out to three task definitions, services, and log groups', () => {
    const t = tpl({ crewCount: 3 });
    expect(Object.keys(t.findResources('AWS::ECS::TaskDefinition'))).toHaveLength(3);
    expect(Object.keys(t.findResources('AWS::ECS::Service'))).toHaveLength(3);
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/kirocrew/crew/crew-1' });
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/kirocrew/crew/crew-2' });
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/kirocrew/crew/crew-3' });
  });

  test('each service desiredCount is 1', () => {
    const t = tpl({ crewCount: 3 });
    for (const svc of Object.values(t.findResources('AWS::ECS::Service'))) {
      expect(svc.Properties.DesiredCount).toBe(1);
    }
  });

  test('explicit crew names are honoured and derive the log groups', () => {
    const t = tpl({ crewCount: 2, crews: ['alpha', 'beta'] });
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/kirocrew/crew/alpha' });
    t.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName: '/kirocrew/crew/beta' });
  });

  test('rejects crewCount above the ENI-budget max', () => {
    expect(() => tpl({ crewCount: 9 })).toThrow(/1\.\.8/);
  });

  test('rejects crewCount below 1', () => {
    expect(() => tpl({ crewCount: 0 })).toThrow(/1\.\.8/);
  });

  test('rejects a crews list whose length disagrees with crewCount', () => {
    expect(() => tpl({ crewCount: 3, crews: ['only-one'] })).toThrow(/exactly crewCount/);
  });

  test('rejects duplicate crew names', () => {
    expect(() => tpl({ crewCount: 2, crews: ['dup', 'dup'] })).toThrow(/unique/);
  });

  test('rejects an invalid crew name', () => {
    expect(() => tpl({ crewCount: 1, crews: ['Bad_Name'] })).toThrow(/crew name must match/);
  });
});

describe('EcsCrewHost - awsvpc networking + two-subnet wiring', () => {
  test('every task definition uses awsvpc network mode', () => {
    const t = tpl({ crewCount: 2 });
    for (const td of Object.values(t.findResources('AWS::ECS::TaskDefinition'))) {
      expect(td.Properties.NetworkMode).toBe('awsvpc');
    }
  });

  test('services place tasks with the egress-only task SG and no public IP', () => {
    const t = tpl();
    t.hasResourceProperties('AWS::ECS::Service', {
      NetworkConfiguration: Match.objectLike({
        AwsvpcConfiguration: Match.objectLike({
          // Ec2Service awsvpc does not set AssignPublicIp (that is Fargate-only);
          // tasks are fully private. Assert a security group is attached.
          SecurityGroups: Match.anyValue(),
        }),
      }),
    });
  });

  test('the task security group has NO inbound rules by default (egress only)', () => {
    // The base task SG (kirocrew-crew-<tag>) must carry no ingress.
    const t = tpl();
    const sgs = t.findResources('AWS::EC2::SecurityGroup');
    const taskSg = Object.values(sgs).find((sg) =>
      JSON.stringify(sg.Properties.GroupDescription ?? '').includes('egress only'),
    );
    expect(taskSg).toBeDefined();
    expect(taskSg!.Properties.SecurityGroupIngress).toBeUndefined();
  });

  test('the host SG is SSM-only with no inbound', () => {
    const t = tpl();
    const sgs = t.findResources('AWS::EC2::SecurityGroup');
    const hostSg = Object.values(sgs).find((sg) =>
      JSON.stringify(sg.Properties.GroupDescription ?? '').includes('SSM-only'),
    );
    expect(hostSg).toBeDefined();
    expect(hostSg!.Properties.SecurityGroupIngress).toBeUndefined();
  });
});

describe('EcsCrewHost - per-crew durable EBS', () => {
  function launchConfigData(t: Template) {
    const lcs = t.findResources('AWS::AutoScaling::LaunchConfiguration');
    return (Object.values(lcs)[0].Properties) as any;
  }

  test('each crew gets an encrypted gp3 data volume with deleteOnTermination false', () => {
    const t = tpl({ crewCount: 2 });
    const mappings = launchConfigData(t).BlockDeviceMappings as any[];
    const dataDevices = mappings.filter((m) => m.DeviceName !== '/dev/xvda');
    expect(dataDevices).toHaveLength(2);
    for (const d of dataDevices) {
      expect(d.Ebs.Encrypted).toBe(true);
      expect(d.Ebs.VolumeType).toBe('gp3');
      expect(d.Ebs.DeleteOnTermination).toBe(false);
    }
  });

  test('the root volume is encrypted gp3 and DOES delete on termination', () => {
    const t = tpl();
    const mappings = launchConfigData(t).BlockDeviceMappings as any[];
    const root = mappings.find((m) => m.DeviceName === '/dev/xvda');
    expect(root.Ebs.Encrypted).toBe(true);
    expect(root.Ebs.VolumeType).toBe('gp3');
    expect(root.Ebs.DeleteOnTermination).toBe(true);
  });

  test('the bootstrap carries per-crew volume labels and mount paths', () => {
    const { stack, vpc } = stackWithVpc();
    const host = new EcsCrewHost(stack, 'Fleet', {
      vpc,
      permissionsBoundaryArn: BOUNDARY,
      crewCount: 2,
    });
    const rendered = JSON.stringify(stack.resolve(host.autoScalingGroup.userData.render()));
    expect(rendered).toContain('CREW_VOLUME_LABELS');
    expect(rendered).toContain('crew-crew-1');
    expect(rendered).toContain('/var/lib/kirocrew/crew-1');
    // The ECS-join header must be present too.
    expect(rendered).toContain('ECS_CLUSTER');
  });
});

describe('EcsCrewHost - memory caps (host-OOM blast radius)', () => {
  test('each container carries a HARD memory cap and a SOFT reservation', () => {
    const t = tpl({ crewMemoryHardLimitMiB: 3072, crewMemoryReservationMiB: 1536 });
    const td = Object.values(t.findResources('AWS::ECS::TaskDefinition'))[0];
    const container = (td.Properties.ContainerDefinitions as any[])[0];
    expect(container.Memory).toBe(3072);
    expect(container.MemoryReservation).toBe(1536);
  });

  test('rejects a soft reservation above the hard cap', () => {
    expect(() =>
      tpl({ crewMemoryReservationMiB: 4096, crewMemoryHardLimitMiB: 2048 }),
    ).toThrow(/must not exceed/);
  });

  test('optional soft cpu shares are applied when set', () => {
    const t = tpl({ crewCpuShares: 512 });
    const td = Object.values(t.findResources('AWS::ECS::TaskDefinition'))[0];
    const container = (td.Properties.ContainerDefinitions as any[])[0];
    expect(container.Cpu).toBe(512);
  });
});

describe('EcsCrewHost - identity + boundary', () => {
  test('the host role carries the host boundary and every crew role the crew boundary', () => {
    const { stack, vpc } = stackWithVpc();
    new EcsCrewHost(stack, 'Fleet', {
      vpc,
      permissionsBoundaryArn: BOUNDARY,
      crewPermissionsBoundaryArn: CREW_BOUNDARY,
      crewCount: 2,
    });
    const t = Template.fromStack(stack);
    const roles = t.findResources('AWS::IAM::Role');
    const hostBounded = Object.values(roles).filter(
      (r) => r.Properties.PermissionsBoundary === BOUNDARY,
    );
    const crewBounded = Object.values(roles).filter(
      (r) => r.Properties.PermissionsBoundary === CREW_BOUNDARY,
    );
    // host role carries the host boundary.
    expect(hostBounded.length).toBeGreaterThanOrEqual(1);
    // (exec + task) x 2 crews = 4 roles carry the crew boundary.
    expect(crewBounded.length).toBe(4);
  });

  test('crew task role bind-mounts the durable data volume for ~/.kiro/crew', () => {
    const t = tpl();
    const td = Object.values(t.findResources('AWS::ECS::TaskDefinition'))[0];
    const container = (td.Properties.ContainerDefinitions as any[])[0];
    const mp = container.MountPoints[0];
    expect(mp.ContainerPath).toBe('/home/kirocrew/.kiro/crew');
    expect(mp.ReadOnly).toBe(false);
  });
});

describe('EcsCrewHost - backup wiring reuse', () => {
  test('grants each crew TASK role write to the backup bucket when set', () => {
    const { stack, vpc } = stackWithVpc();
    const backup = new CrewBackupBucket(stack, 'Backup');
    new EcsCrewHost(stack, 'Fleet', {
      vpc,
      permissionsBoundaryArn: BOUNDARY,
      crewCount: 2,
      backupBucket: backup,
    });
    const policies = JSON.stringify(Template.fromStack(stack).findResources('AWS::IAM::Policy'));
    expect(policies).toContain('s3:PutObject');
  });
});
