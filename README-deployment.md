# Well-Architected Report Visualizer - Deployment Guide

This guide provides instructions for deploying the Well-Architected Report Visualizer using CloudFormation stacks.

## Solution Architecture

The Well-Architected Report Visualizer consists of the following components:

1. **Web Application** - A static website hosted in an S3 bucket
2. **Lambda Proxy** - A Lambda function that interfaces with the AWS Well-Architected API
3. **API Gateway** - An API Gateway that exposes the Lambda function to the web application
4. **CloudFront Distribution (Optional)** - A CloudFront distribution for improved performance and HTTPS

The solution is deployed using a set of nested CloudFormation stacks:

- **Master Stack** - Orchestrates the deployment of all other stacks
- **Infrastructure Stack** - Deploys S3 buckets and CloudFront
- **Lambda Stack** - Deploys the Lambda function and API Gateway
- **Content Stack** - Deploys the web application content to the S3 bucket

## Prerequisites

Before deploying the solution, you need:

1. AWS CLI installed and configured with appropriate permissions
2. The source code files:
   - CloudFormation templates (`wa-visualizer-*.yaml`)
   - Web application files (`wa-summary.html`, `script.js`, `styles.css`)
   - Deployment script (`deploy.sh`)

## Deployment Steps

### 1. Prepare the Deployment Files

Ensure you have all the required files in your working directory:

```
wa-visualizer-infra.yaml
wa-visualizer-lambda.yaml
wa-visualizer-content.yaml
wa-visualizer-master.yaml
wa-summary.html
script.js
styles.css
deploy.sh
```

### 2. Make the Deployment Script Executable

```bash
chmod +x deploy.sh
```

### 3. Run the Deployment Script

The script can be run with default values:

```bash
./deploy.sh
```

Or with custom parameters:

```bash
./deploy.sh \
  --region us-west-2 \
  --stack-name my-wa-visualizer \
  --deployment-bucket my-deployment-bucket \
  --website-bucket my-website-bucket \
  --project-name myproject \
  --environment dev \
  --cloudfront false \
  --lambda-name my-wa-proxy \
  --api-name MyWAApi \
  --api-stage dev
```

### 4. Available Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `--region` | AWS region to deploy to | us-east-1 |
| `--stack-name` | Name of the CloudFormation stack | wa-visualizer |
| `--deployment-bucket` | S3 bucket for deployment artifacts | wa-visualizer-deployment-{account-id} |
| `--website-bucket` | S3 bucket for the website | wa-visualizer-website-{account-id} |
| `--project-name` | Project name for resource tagging | wellarchitectedsummary |
| `--environment` | Deployment environment (dev/test/prod) | prod |
| `--cloudfront` | Whether to create a CloudFront distribution (true/false) | true |
| `--lambda-name` | Name of the Lambda function | wellarchitected-proxy |
| `--api-name` | Name of the API Gateway | WellArchitectedProxyApi |
| `--api-stage` | Name of the API Gateway stage | prod |

## Post-Deployment

After successful deployment, the script will output:

1. The website URL (S3 website endpoint)
2. The API endpoint URL
3. The CloudFront domain name (if CloudFront was enabled)

## Using the Well-Architected Report Visualizer

1. Open the website URL in your browser
2. Enter a Well-Architected workload ARN or click "List Available Workloads"
3. View the generated report

## Troubleshooting

### Common Issues

1. **S3 Bucket Name Conflicts**: S3 bucket names must be globally unique. If deployment fails due to bucket name conflicts, use the `--deployment-bucket` and `--website-bucket` parameters to specify unique names.

2. **Permission Issues**: Ensure your AWS CLI user has sufficient permissions to create all the required resources.

3. **CloudFront Errors**: If you encounter issues with CloudFront, try deploying without it by setting `--cloudfront false`.

### Checking Logs

To troubleshoot Lambda function issues:

```bash
aws logs describe-log-streams \
  --log-group-name /aws/lambda/wellarchitected-proxy \
  --order-by LastEventTime \
  --descending \
  --limit 1

aws logs get-log-events \
  --log-group-name /aws/lambda/wellarchitected-proxy \
  --log-stream-name [LOG_STREAM_NAME_FROM_PREVIOUS_COMMAND]
```

## Cleanup

To delete all resources created by this solution:

```bash
aws cloudformation delete-stack --stack-name wa-visualizer
```

Note: This will delete all resources except the S3 buckets. To delete the buckets, you must first empty them:

```bash
aws s3 rm s3://[WEBSITE_BUCKET_NAME] --recursive
aws s3 rm s3://[DEPLOYMENT_BUCKET_NAME] --recursive
```

Then delete the stack again to remove the empty buckets.
