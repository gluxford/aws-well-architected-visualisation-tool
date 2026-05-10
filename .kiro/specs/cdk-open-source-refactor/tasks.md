# Tasks: CDK Open Source Refactor

## Task 1: Initialize CDK Project Structure

- [x] 1.1 Create `infra/` directory with CDK TypeScript project (`package.json`, `tsconfig.json`, `cdk.json`)
- [x] 1.2 Create `infra/bin/app.ts` CDK app entry point with RegionalStack and GlobalStack instantiation
- [x] 1.3 Create `infra/lib/config.ts` with `DeploymentConfig` interface and validation logic
- [x] 1.4 Configure `cdk.json` context with default configuration values (projectName, primaryRegion, emailRestriction, mfa)

## Task 2: Create RegionalStack - Core Resources

- [x] 2.1 Create `infra/lib/regional-stack.ts` with S3 bucket construct (website hosting, OAC-ready, no public access)
- [x] 2.2 Add Cognito User Pool construct with configurable MFA (required/optional/off mapping)
- [x] 2.3 Add Cognito User Pool Client construct
- [x] 2.4 Add IAM roles for Lambda execution (WellArchitected API permissions)

## Task 3: Create RegionalStack - Lambda Functions

- [x] 3.1 Create `lambda/proxy/lambda_function.py` (refactored from lambda_function_improved.py: remove hardcoded region, use ALLOWED_ORIGIN env var for CORS, remove IP restriction)
- [x] 3.2 Create `lambda/proxy/requirements.txt` (empty or minimal — no boto3/botocore)
- [x] 3.3 Create `lambda/pre-signup/lambda_function.py` (configurable domain validation via ALLOWED_DOMAINS env var)
- [x] 3.4 Add Proxy Lambda construct to RegionalStack with Python bundling from `lambda/proxy/`
- [x] 3.5 Add PreSignup Lambda construct (conditionally created when emailRestriction.enabled=true)
- [x] 3.6 Wire PreSignup Lambda as Cognito pre-signup trigger (conditional)

## Task 4: Create RegionalStack - API Gateway

- [x] 4.1 Add REST API Gateway construct with `/proxy` resource
- [x] 4.2 Add POST method with Lambda proxy integration
- [x] 4.3 Add OPTIONS method with MOCK integration for CORS preflight
- [x] 4.4 Add API Gateway deployment and stage

## Task 5: Create GlobalStack - CloudFront & Deployment

- [x] 5.1 Create `infra/lib/global-stack.ts` with CloudFront distribution (S3 OAC origin, us-east-1)
- [x] 5.2 Add optional custom domain and ACM certificate attachment (conditional on config)
- [x] 5.3 Add runtime-config.json generation (Cognito IDs, API URL, region, email restriction settings)
- [x] 5.4 Add S3 BucketDeployment for frontend assets + runtime-config.json with CloudFront invalidation
- [x] 5.5 Pass CloudFront/custom domain to RegionalStack Proxy Lambda as ALLOWED_ORIGIN environment variable

## Task 6: Reorganize Frontend Assets

- [x] 6.1 Create `frontend/` directory structure
- [x] 6.2 Move and rename `wa-api-visualizer.html` to `frontend/index.html`
- [x] 6.3 Move `script-improved.js` to `frontend/js/app.js` — replace hardcoded API_ENDPOINT with runtime-config.json lookup
- [x] 6.4 Move `auth-overlay.js` to `frontend/js/auth.js` — replace hardcoded COGNITO_CONFIG with runtime-config.json lookup, make domain label dynamic
- [x] 6.5 Create `frontend/config-loader.js` that fetches and exposes `runtime-config.json` values

## Task 7: Remove Legacy Files

- [x] 7.1 Delete bash deployment scripts (deploy-cognito.sh, deploy-cognito-proper.sh, deploy-multi-region-fixed.sh, deploy-multi-region.sh)
- [x] 7.2 Delete bash cleanup scripts (cleanup-cognito.sh, cleanup-multi-region-fixed.sh, cleanup-multi-region.sh, cleanup-repository.sh)
- [x] 7.3 Delete CloudFormation YAML templates (wa-visualizer-regional.yaml, wa-visualizer-global.yaml, wa-visualizer-regional-secure.yaml)
- [x] 7.4 Delete bundled dependency directories in lambda-proxy/ (boto3/, botocore/, dateutil/, jmespath/, s3transfer/, urllib3/, etc.)
- [x] 7.5 Delete legacy files (lambda-function.zip, manage-ips.sh, placeholder.py, temp/, ACTIVE-FILES.md, DEPLOYMENT-GUIDE.md, QUICK-DEPLOY.md, SECURITY-UPDATES.md)

## Task 8: Update Documentation

- [x] 8.1 Rewrite README.md with: project overview, prerequisites, configuration options table, deployment commands (`cdk deploy --all`, `cdk destroy`), and architecture diagram
- [x] 8.2 Update .gitignore for CDK project (cdk.out/, node_modules/, *.js in infra/, *.d.ts)

## Task 9: Write Tests

- [x] 9.1 Create `infra/test/config.test.ts` — property-based tests for config validation (Property 1) using fast-check
- [x] 9.2 Create `lambda/pre-signup/test_lambda.py` — property-based tests for email domain validation (Property 2) using hypothesis
- [x] 9.3 Create `infra/test/regional-stack.test.ts` — unit tests for MFA mapping, resource prefix (Property 3), and CDK synthesis snapshots
- [x] 9.4 Create `infra/test/global-stack.test.ts` — unit tests for runtime config generation (Property 4), custom domain conditional, CloudFront config
- [x] 9.5 Create `lambda/proxy/test_lambda.py` — property-based tests for CORS origin header (Property 5) using hypothesis
- [x] 9.6 Create `frontend/test/config-display.test.js` — property-based test for domain label rendering (Property 6) using fast-check
