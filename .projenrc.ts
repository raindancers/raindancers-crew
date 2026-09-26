import { awscdk, javascript } from 'projen';

const project = new awscdk.AwsCdkConstructLibrary({
  author: 'raindancers',
  authorAddress: 'andrew@raindancers.cloud',
  cdkVersion: '2.260.0',
  // The release workflow triggers on pushes to this branch, so it must be the
  // branch merges actually land on. feat/remote-crew-instance is the repo
  // default/integration branch; main is not used, so a release cut from main
  // would never fire.
  defaultReleaseBranch: 'feat/remote-crew-instance',
  // Publish releases. AwsCdkConstructLibrary defaults release to true, but pin
  // it so the release + npm-publish workflow is an explicit, reviewable choice.
  release: true,
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
  // Publish @raindancers/raindancers-crew to the public npm registry. For a
  // jsii library the npm target is driven by the jsii release workflow (the
  // generated release_npm job runs publib-npm against registry.npmjs.org and
  // authenticates via the NPM_TOKEN Actions secret). A scoped package needs
  // public access, so keep npmAccess PUBLIC and the default public registry.
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
// projen names the release task `release` on the main branch but
// `release:<branch>` on any other default release branch, so look up both.
const releaseTask =
  project.tasks.tryFind('release') ??
  project.tasks.tryFind('release:feat/remote-crew-instance');
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
