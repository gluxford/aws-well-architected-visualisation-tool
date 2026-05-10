#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RegionalStack } from '../lib/regional-stack';
import { GlobalStack } from '../lib/global-stack';
import { DeploymentConfig, validateConfig } from '../lib/config';

const app = new cdk.App();

// Load configuration from cdk.json context
const configContext = app.node.tryGetContext('config');
if (!configContext) {
  throw new Error('Missing "config" in cdk.json context. Please provide deployment configuration.');
}

// Validate configuration
const config: DeploymentConfig = validateConfig(configContext);

// Deploy RegionalStack to the configured primary region
const regionalStack = new RegionalStack(app, `${config.projectName}-regional`, {
  config,
  allowedOrigin: config.customDomain
    ? `https://${config.customDomain.domainName}`
    : undefined,
  crossRegionReferences: true,
  env: {
    region: config.primaryRegion,
  },
});

// Deploy GlobalStack to us-east-1 (required for CloudFront)
const globalStack = new GlobalStack(app, `${config.projectName}-global`, {
  config,
  s3BucketArn: regionalStack.s3BucketArn,
  s3BucketDomainName: regionalStack.s3BucketDomainName,
  cognitoUserPoolId: regionalStack.cognitoUserPoolId,
  cognitoClientId: regionalStack.cognitoClientId,
  apiUrl: regionalStack.apiUrl,
  crossRegionReferences: true,
  env: {
    region: 'us-east-1',
  },
});

// GlobalStack depends on RegionalStack outputs
globalStack.addDependency(regionalStack);
