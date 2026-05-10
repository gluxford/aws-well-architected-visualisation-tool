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
- [AWS CDK CLI](https://docs.aws.amazon.com/cdk/v2/guide/cli.html) (`npm install -g aws-cdk`)
- AWS credentials configured (via environment variables, `~/.aws/credentials`, or SSO)
- CDK bootstrapped in your target regions: `cdk bootstrap aws://ACCOUNT/REGION`

## Quick Start

```bash
# Install dependencies
cd infra
npm install

# Review/edit configuration
# Edit infra/cdk.json → context.config

# Deploy all stacks
cdk deploy --all

# Destroy all resources when done
cdk destroy --all
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

```bash
# Synthesize CloudFormation templates (dry run)
cd infra && cdk synth

# Deploy all stacks
cdk deploy --all

# Deploy a specific stack
cdk deploy wa-visualizer-regional
cdk deploy wa-visualizer-global

# View differences before deploying
cdk diff

# Destroy all resources
cdk destroy --all
```

## How It Works

1. **CDK deploys** the RegionalStack (S3, Cognito, Lambda, API Gateway) to your chosen region
2. **CDK deploys** the GlobalStack (CloudFront) to us-east-1
3. **GlobalStack generates** `runtime-config.json` with Cognito IDs, API URL, and settings
4. **Frontend assets** + config are uploaded to S3 with CloudFront cache invalidation
5. **Users access** the app via CloudFront URL, authenticate via Cognito, and view WA reports

## License

MIT
