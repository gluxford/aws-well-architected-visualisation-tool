# AWS Well-Architected Report Visualizer

A configurable, open-source tool for visualizing AWS Well-Architected Framework assessment results. Deployed as infrastructure-as-code using AWS CDK (TypeScript).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GlobalStack (us-east-1)                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CloudFront Distribution (OAC → S3)                  │    │
│  │  + S3 BucketDeployment (frontend + runtime-config)   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│               RegionalStack (your chosen region)             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐     │
│  │ S3 Bucket│  │ Cognito User │  │ API Gateway (REST) │     │
│  │ (assets) │  │ Pool + Client│  │ POST /proxy        │     │
│  └──────────┘  └──────────────┘  └────────┬──────────┘     │
│                       │                     │                │
│              ┌────────┴───────┐    ┌───────┴────────┐       │
│              │ PreSignup      │    │ Proxy Lambda    │       │
│              │ Lambda (opt.)  │    │ (WA API calls)  │       │
│              └────────────────┘    └────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18.x
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) (`npm install -g aws-cdk`)
- An AWS account with appropriate permissions
- CDK bootstrapped in your target regions (see below)

## AWS Authentication

This project uses standard AWS credential resolution. The most common approach for organizations is AWS IAM Identity Center (SSO).

### Option 1: AWS SSO (Recommended for organizations)

1. Configure an SSO profile (one-time setup):

```bash
aws configure sso
# Follow the prompts:
#   SSO session name: my-session
#   SSO start URL: https://your-org.awsapps.com/start
#   SSO region: your-sso-region (e.g. ap-southeast-2)
#   Choose your account and role
#   CLI default output format: json
#   CLI profile name: my-profile
```

2. Log in before running CDK commands:

```bash
aws sso login --profile my-profile
```

3. Pass the profile to all CDK commands using `--profile`:

```bash
cdk deploy --all --profile my-profile
```

Or export it for the session so you don't need to repeat it:

```bash
export AWS_PROFILE=my-profile
cdk deploy --all
```

### Option 2: IAM Access Keys

If you have long-lived access keys configured in `~/.aws/credentials`:

```bash
# Uses the [default] profile automatically
cdk deploy --all

# Or specify a named profile
cdk deploy --all --profile my-profile
```

### Option 3: Environment Variables

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-southeast-2
cdk deploy --all
```

### Bootstrapping CDK

Before your first deployment, bootstrap CDK in each region you'll use. This creates the staging resources CDK needs:

```bash
# Bootstrap your primary region
cdk bootstrap aws://ACCOUNT_ID/REGION --profile my-profile

# Bootstrap us-east-1 (required for CloudFront)
cdk bootstrap aws://ACCOUNT_ID/us-east-1 --profile my-profile
```

Replace `ACCOUNT_ID` with your 12-digit AWS account ID and `REGION` with your chosen `primaryRegion`.

## Quick Start

```bash
# Install dependencies
cd infra
npm install

# Review/edit configuration
# Edit infra/cdk.json → context.config

# Log in (if using SSO)
aws sso login --profile my-profile

# Deploy all stacks
cdk deploy --all --profile my-profile

# Destroy all resources when done
cdk destroy --all --profile my-profile
```

## Configuration

All configuration is in `infra/cdk.json` under `context.config`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `projectName` | string | `"wa-visualizer"` | Resource name prefix (alphanumeric + hyphens, starts with letter) |
| `primaryRegion` | string | `"us-east-1"` | AWS region for regional resources (S3, Lambda, API GW, Cognito) |
| `emailRestriction.enabled` | boolean | `false` | Toggle email domain restriction for sign-up |
| `emailRestriction.allowedDomains` | string[] | — | Required when enabled. e.g. `["example.com"]` |
| `mfa` | string | `"optional"` | Cognito MFA policy: `"required"`, `"optional"`, or `"off"` |
| `customDomain.domainName` | string | — | Optional custom domain for CloudFront |
| `customDomain.certificateArn` | string | — | ACM certificate ARN (must be in us-east-1) |

### Example Configuration

```json
{
  "context": {
    "config": {
      "projectName": "my-wa-tool",
      "primaryRegion": "ap-southeast-2",
      "emailRestriction": {
        "enabled": true,
        "allowedDomains": ["mycompany.com"]
      },
      "mfa": "required",
      "customDomain": null
    }
  }
}
```

## Project Structure

```
├── infra/                  # CDK infrastructure code
│   ├── bin/app.ts          # CDK app entry point
│   ├── lib/
│   │   ├── config.ts       # Configuration interface & validation
│   │   ├── regional-stack.ts  # S3, Cognito, Lambda, API Gateway
│   │   └── global-stack.ts    # CloudFront, S3 deployment
│   └── test/               # Infrastructure tests
├── lambda/
│   ├── proxy/              # Well-Architected API proxy Lambda
│   └── pre-signup/         # Cognito pre-signup trigger Lambda
├── frontend/               # Static frontend assets
│   ├── index.html
│   ├── config-loader.js
│   └── js/
└── README.md
```

## Deployment Commands

All commands below assume you're in the `infra/` directory. Add `--profile my-profile` if not using `AWS_PROFILE` env var.

```bash
cd infra

# Synthesize CloudFormation templates (dry run, no AWS calls)
cdk synth

# Preview what will change before deploying
cdk diff

# Deploy all stacks
cdk deploy --all

# Deploy a specific stack
cdk deploy wa-visualizer-regional
cdk deploy wa-visualizer-global

# Destroy all resources
cdk destroy --all
```

## How It Works

1. **CDK deploys** the RegionalStack (S3, Cognito, Lambda, API Gateway) to your chosen region
2. **CDK deploys** the GlobalStack (CloudFront) to us-east-1
3. **GlobalStack generates** `runtime-config.json` with Cognito IDs, API URL, and settings
4. **Frontend assets** + config are uploaded to S3 with CloudFront cache invalidation
5. **Users access** the app via CloudFront URL, authenticate via Cognito, and view WA reports

## Demo Mode

You can preview the visualizer without deploying to AWS. Open `frontend/demo.html` in your browser — it uses embedded sample workload data and requires no backend or credentials.

Two sample workloads are included:
- **E-Commerce Platform** — strong Operational Excellence & Reliability, poor Cost Optimization & Security
- **Data Analytics Pipeline** — strong Cost Optimization, balanced Security & Performance, poor Reliability & Sustainability

## Security Scanning

Before running `npm install`, audit dependencies for known vulnerabilities:

```bash
cd infra

# Basic vulnerability check (built into npm)
npm audit

# Fix auto-fixable vulnerabilities
npm audit fix
```

For deeper supply chain analysis (typosquatting, install scripts, maintainer changes), use [Socket.dev](https://socket.dev):

```bash
# Install Socket CLI (one-time)
npm install -g @socketsecurity/cli

# Login (requires free Socket.dev account)
socket login

# Run a full scan
socket scan create .

# Or wrap npm install with Socket protection
socket npm install
```

### Current Dependency Status

All direct dependencies are well-known, actively maintained packages:

| Package | Purpose | Publisher |
|---------|---------|-----------|
| `aws-cdk-lib` | AWS CDK constructs | AWS |
| `constructs` | CDK construct base | AWS |
| `typescript` | TypeScript compiler | Microsoft |
| `ts-node` | TypeScript execution | Community (widely used) |
| `jest` / `ts-jest` | Testing framework | Meta/Community |
| `fast-check` | Property-based testing | Community (widely used) |

**Known advisory:** `fast-uri` (bundled inside `aws-cdk-lib`) has a path traversal vulnerability. This is a build-time dependency only — it does not run in deployed Lambda functions or the frontend. It will be resolved when AWS publishes an updated `aws-cdk-lib`.

## Troubleshooting

**"Unable to resolve AWS account"** — Your credentials have expired. Run `aws sso login --profile my-profile` again.

**"CDKToolkit stack not found"** — You haven't bootstrapped CDK in that region. Run `cdk bootstrap aws://ACCOUNT/REGION --profile my-profile`.

**"Access Denied" during deploy** — Your SSO role may not have sufficient permissions. You need permissions to create S3, Lambda, API Gateway, Cognito, CloudFront, and IAM resources.

## License

MIT
