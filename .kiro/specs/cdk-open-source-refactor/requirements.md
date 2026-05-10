# Requirements Document

## Introduction

Refactor the AWS Well-Architected Report Visualizer from a company-specific internal tool into an open-source, configurable solution. Replace bash script deployment with AWS CDK infrastructure-as-code, remove all hardcoded company-specific values, and parameterize the solution so any organization can clone, configure, and deploy to their own AWS environment.

## Glossary

- **CDK_App**: The AWS CDK application that defines all infrastructure stacks for the Well-Architected Visualizer
- **Configuration_File**: A user-editable file (e.g., cdk.json context or a config file) containing all deployment parameters
- **Regional_Stack**: The CDK stack deploying resources to the user's chosen primary region (S3, Lambda, API Gateway, Cognito)
- **Global_Stack**: The CDK stack deploying resources to us-east-1 (CloudFront distribution)
- **PreSignup_Lambda**: The Cognito pre-signup trigger Lambda that validates email domains
- **Proxy_Lambda**: The Lambda function that proxies requests to the AWS Well-Architected API
- **Frontend_Assets**: The static HTML, JavaScript, and CSS files served via CloudFront/S3
- **Deployer**: A person deploying the solution to their own AWS account

## Requirements

### Requirement 1: Configurable Email Domain Restriction

**User Story:** As a Deployer, I want to optionally restrict sign-up to specific email domains via a configuration toggle, so that I can either limit access to my organization or allow open registration.

#### Acceptance Criteria

1. THE Configuration_File SHALL accept an email restriction enabled parameter with values: true or false
2. WHEN email restriction is set to true, THE Configuration_File SHALL require one or more allowed email domains to be specified
3. WHEN email restriction is set to true AND a user registers with an email matching a configured allowed domain, THE PreSignup_Lambda SHALL allow the registration
4. WHEN email restriction is set to true AND a user registers with an email not matching any configured allowed domain, THE PreSignup_Lambda SHALL reject the registration with a descriptive error message
5. WHEN email restriction is set to false, THE PreSignup_Lambda SHALL allow registration from any email domain without restriction
6. WHEN email restriction is set to true, THE Frontend_Assets SHALL display the configured allowed domain(s) in the sign-up form label
7. WHEN email restriction is set to false, THE Frontend_Assets SHALL display a generic email label without domain restriction messaging

### Requirement 2: Configurable AWS Region Deployment

**User Story:** As a Deployer, I want to deploy the regional resources to any AWS region, so that I can choose a region close to my users or compliant with my data residency requirements.

#### Acceptance Criteria

1. THE Configuration_File SHALL accept a primary deployment region parameter for the Regional_Stack
2. WHEN the Deployer specifies a primary region, THE CDK_App SHALL deploy all regional resources (S3, Lambda, API Gateway, Cognito) to that region
3. THE CDK_App SHALL deploy the Global_Stack to us-east-1 regardless of the primary region selection (CloudFront requirement)
4. THE Proxy_Lambda SHALL use the deployment region for AWS Well-Architected API calls without hardcoding a region value

### Requirement 3: Removal of Hardcoded AWS Profile References

**User Story:** As a Deployer, I want to use any AWS credentials or profile for deployment, so that I am not restricted to a specific named profile.

#### Acceptance Criteria

1. THE CDK_App SHALL NOT contain any hardcoded AWS profile names
2. THE CDK_App SHALL rely on standard AWS credential resolution (environment variables, default profile, or CLI-specified profile)
3. WHEN the Deployer runs CDK commands, THE CDK_App SHALL use whatever credentials are active in the environment

### Requirement 4: CDK Infrastructure-as-Code Replacement

**User Story:** As a Deployer, I want the infrastructure defined in AWS CDK (TypeScript), so that I get type safety, IDE support, and a standard IaC workflow instead of bash scripts.

#### Acceptance Criteria

1. THE CDK_App SHALL define all resources currently in wa-visualizer-regional.yaml as CDK constructs in the Regional_Stack
2. THE CDK_App SHALL define all resources currently in wa-visualizer-global.yaml as CDK constructs in the Global_Stack
3. THE CDK_App SHALL produce a deployable solution with a single `cdk deploy --all` command
4. THE CDK_App SHALL handle Lambda function bundling (zipping the lambda-proxy directory with dependencies) as part of the CDK synthesis process
5. THE CDK_App SHALL handle uploading Frontend_Assets to S3 and invalidating the CloudFront cache as part of the deployment process

### Requirement 5: Configurable Project Naming

**User Story:** As a Deployer, I want to specify a custom project name prefix, so that resources are named according to my organization's conventions and do not conflict with other deployments.

#### Acceptance Criteria

1. THE Configuration_File SHALL accept a project name parameter
2. WHEN the Deployer specifies a project name, THE CDK_App SHALL use that name as a prefix for all created AWS resources
3. THE CDK_App SHALL use a sensible default project name when none is specified

### Requirement 6: Configurable MFA Policy

**User Story:** As a Deployer, I want to choose whether MFA is required, optional, or disabled for my deployment, so that I can match my organization's security policy.

#### Acceptance Criteria

1. THE Configuration_File SHALL accept an MFA configuration parameter with values: required, optional, or off
2. WHEN MFA is set to required, THE Regional_Stack SHALL configure the Cognito User Pool with mandatory software token MFA
3. WHEN MFA is set to optional, THE Regional_Stack SHALL configure the Cognito User Pool with optional MFA
4. WHEN MFA is set to off, THE Regional_Stack SHALL configure the Cognito User Pool with MFA disabled

### Requirement 7: Frontend Configuration Injection

**User Story:** As a Deployer, I want the frontend to automatically receive the correct Cognito and API Gateway configuration after deployment, so that I do not need to manually edit JavaScript files.

#### Acceptance Criteria

1. WHEN the CDK deployment completes, THE CDK_App SHALL generate a runtime configuration file containing the Cognito User Pool ID, Client ID, region, and API Gateway URL
2. THE Frontend_Assets SHALL load configuration from the generated runtime configuration file instead of using hardcoded values
3. THE CDK_App SHALL upload the generated configuration file to S3 alongside the Frontend_Assets

### Requirement 8: Lambda Dependency Management

**User Story:** As a Deployer, I want Lambda dependencies managed through standard Python packaging, so that dependencies are reproducible and up to date.

#### Acceptance Criteria

1. THE CDK_App SHALL install Python dependencies from a requirements.txt file during the Lambda bundling process
2. THE CDK_App SHALL NOT require pre-bundled boto3/botocore directories in the source repository
3. THE Proxy_Lambda SHALL use the AWS Lambda runtime-provided boto3 by default, with requirements.txt only listing additional dependencies if needed

### Requirement 9: Clean Repository Structure

**User Story:** As a Deployer, I want a clean, well-organized repository that follows CDK project conventions, so that the project is easy to understand and contribute to.

#### Acceptance Criteria

1. THE CDK_App SHALL organize infrastructure code in a dedicated directory (e.g., infra/ or cdk/)
2. THE CDK_App SHALL organize Lambda function source code in a dedicated directory separate from bundled dependencies
3. THE CDK_App SHALL organize Frontend_Assets in a dedicated directory (e.g., frontend/)
4. THE CDK_App SHALL include a README with setup instructions, configuration options, and deployment commands

### Requirement 10: Removal of Legacy Deployment Scripts

**User Story:** As a Deployer, I want the repository to contain only the CDK-based deployment approach, so that there is no confusion about which deployment method to use.

#### Acceptance Criteria

1. THE CDK_App repository SHALL NOT contain bash deployment scripts (deploy-cognito.sh, deploy-multi-region-fixed.sh, deploy-multi-region.sh)
2. THE CDK_App repository SHALL NOT contain bash cleanup scripts (cleanup-cognito.sh, cleanup-multi-region-fixed.sh, cleanup-multi-region.sh)
3. THE CDK_App repository SHALL NOT contain raw CloudFormation template files (wa-visualizer-regional.yaml, wa-visualizer-global.yaml, wa-visualizer-regional-secure.yaml)
4. THE CDK_App SHALL provide a `cdk destroy` command for resource cleanup instead of custom cleanup scripts

### Requirement 11: Configurable CORS Origins

**User Story:** As a Deployer, I want CORS origins configured to match my deployment's domain, so that the API is not open to all origins in production.

#### Acceptance Criteria

1. WHEN the CDK deployment completes, THE Proxy_Lambda SHALL set the Access-Control-Allow-Origin header to the CloudFront distribution domain
2. THE CDK_App SHALL pass the CloudFront domain to the Proxy_Lambda as an environment variable
3. IF a custom domain is configured, THEN THE Proxy_Lambda SHALL use the custom domain as the allowed CORS origin

### Requirement 12: Optional Custom Domain Support

**User Story:** As a Deployer, I want to optionally attach a custom domain name to the CloudFront distribution, so that I can serve the application from my organization's domain.

#### Acceptance Criteria

1. THE Configuration_File SHALL accept optional custom domain parameters (domain name and ACM certificate ARN)
2. WHERE a custom domain is configured, THE Global_Stack SHALL attach the domain and certificate to the CloudFront distribution
3. WHERE no custom domain is configured, THE Global_Stack SHALL use the default CloudFront domain name
