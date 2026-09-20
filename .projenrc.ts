import { awscdk, javascript } from 'projen';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'raindancers',
  authorAddress: 'andrew@raindancers.cloud',
  cdkVersion: '2.260.0',
  defaultReleaseBranch: 'main',
  devDeps: [
    '@types/node',
  ],
  description:
    'CDK construct that provisions a self-hosted KiroCrew gateway on a single ' +
    'EC2 instance, reached over SSM Session Manager (no inbound ports). A ' +
    'pipeline-native, version-controlled port of the upstream kirocrew-ec2 ' +
    'CloudFormation template.',
  jsiiVersion: '~5.9.0',
  license: 'Apache-2.0',
  name: '@raindancers/raindancers-crew',
  npmAccess: javascript.NpmAccess.PUBLIC,
  packageManager: javascript.NodePackageManager.NPM,
  projenrcTs: true,
  keywords: ['cdk', 'kirocrew', 'ec2', 'ssm', 'agent'],
  repositoryUrl: 'https://github.com/raindancers/raindancers-crew',
  gitignore: ['*.d.ts', '!src/**/*.d.ts'],
});

// The UserData bootstrap script is shipped as an asset, not a compiled source
// file. Make sure jsii/tsc does not try to treat it as TypeScript and that it
// is packaged into the published tarball for consumers.
project.npmignore?.addPatterns('!src/assets/**');

// Match AgentL's release recompile so JSII RTTI version symbols reset to 0.0.0.
const releaseTask = project.tasks.tryFind('release');
if (releaseTask) {
  releaseTask.reset();
  releaseTask.env('RELEASE', 'true');
  releaseTask.exec('rm -fr dist');
  releaseTask.spawn(project.tasks.tryFind('bump')!);
  releaseTask.spawn(project.tasks.tryFind('build')!);
  releaseTask.spawn(project.tasks.tryFind('unbump')!);
  releaseTask.spawn(project.tasks.tryFind('compile')!);
  releaseTask.exec('git diff --ignore-space-at-eol --exit-code');
}

project.synth();
