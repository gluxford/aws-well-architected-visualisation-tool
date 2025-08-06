#!/bin/bash

# Multi-region deployment script for Well-Architected Visualizer
# Deploys regional resources to ap-southeast-2 and global resources to us-east-1

set -e

# Default values
PROJECT_NAME="cevo-wa-visualiser-tool"
ENVIRONMENT="prod"
REGIONAL_REGION="ap-southeast-2"
GLOBAL_REGION="us-east-1"
IP_ADDRESSES=""
AWS_PROFILE=""

# Function to display usage
usage() {
    echo "Usage: $0 --ip-addresses IP_LIST [--project-name NAME] [--environment ENV] [--profile PROFILE]"
    echo ""
    echo "Options:"
    echo "  --ip-addresses    Comma-separated list of IP addresses in CIDR format (required)"
    echo "  --project-name    Project name prefix (default: cevo-wa-visualiser-tool)"
    echo "  --environment     Environment name (default: prod)"
    echo "  --profile         AWS profile to use"
    echo ""
    echo "Example:"
    echo "  $0 --ip-addresses \"203.0.113.45/32,198.51.100.10/32\" --profile cevo-production"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ip-addresses)
            IP_ADDRESSES="$2"
            shift 2
            ;;
        --project-name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [[ -z "$IP_ADDRESSES" ]]; then
    echo "Error: --ip-addresses is required"
    usage
fi

# Set AWS profile if provided
if [[ -n "$AWS_PROFILE" ]]; then
    export AWS_PROFILE="$AWS_PROFILE"
    echo "Using AWS profile: $AWS_PROFILE"
fi

echo "Starting multi-region deployment..."
echo "Project: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Regional region: $REGIONAL_REGION"
echo "Global region: $GLOBAL_REGION"
echo "IP addresses: $IP_ADDRESSES"
echo ""

# Step 1: Create S3 bucket and upload Lambda function
echo "Step 1: Preparing Lambda function and S3 bucket..."
S3_BUCKET_NAME="${PROJECT_NAME}-website-${ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}-${REGIONAL_REGION}"

# Create S3 bucket if it doesn't exist
aws s3api head-bucket --bucket "$S3_BUCKET_NAME" --region "$REGIONAL_REGION" 2>/dev/null || \
aws s3 mb "s3://$S3_BUCKET_NAME" --region "$REGIONAL_REGION"

# Build Lambda function package from lambda-proxy directory
echo "Building Lambda function package..."
if [ ! -d "lambda-proxy" ]; then
    echo "❌ Error: lambda-proxy directory not found"
    exit 1
fi

# Remove existing lambda-function.zip if it exists
if [ -f "lambda-function.zip" ]; then
    rm lambda-function.zip
fi

# Create the zip file from lambda-proxy directory
cd lambda-proxy
zip -r ../lambda-function.zip . \
    -x "*.git*" \
    -x "*.DS_Store*" \
    -x "__pycache__/*" \
    -x "*.pyc" \
    -x "deploy.sh" \
    -x "README.md" \
    -x "*.yaml" \
    -x "cloudformation.yaml" \
    -x "template.yaml" \
    -x "trust-policy.json" \
    -x "wellarchitected-policy.json" \
    -x "test-credentials.py" \
    -x "function.zip" >/dev/null
cd ..

if [ ! -f "lambda-function.zip" ]; then
    echo "❌ Error: Failed to create lambda-function.zip"
    exit 1
fi

echo "✅ Lambda function package created successfully"

# Create timestamped S3 key to force CloudFormation update
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LAMBDA_S3_KEY="lambda-function-${TIMESTAMP}.zip"

# Upload Lambda function zip file with timestamp
echo "Uploading Lambda function..."
aws s3 cp lambda-function.zip "s3://$S3_BUCKET_NAME/$LAMBDA_S3_KEY" --region "$REGIONAL_REGION"

# Step 2: Deploy regional stack (ap-southeast-2)
echo "Step 2: Deploying regional resources to $REGIONAL_REGION..."
REGIONAL_STACK_NAME="${PROJECT_NAME}-regional"

aws cloudformation deploy \
    --template-file wa-visualizer-regional.yaml \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        LambdaS3Key="$LAMBDA_S3_KEY" \
    --capabilities CAPABILITY_NAMED_IAM \
    --tags \
        Project="$PROJECT_NAME" \
        Environment="$ENVIRONMENT"

echo "Regional stack deployed successfully!"

# Get outputs from regional stack
echo "Getting regional stack outputs..."
S3_BUCKET_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketRegionalDomainName`].OutputValue' \
    --output text)

API_GATEWAY_URL=$(aws cloudformation describe-stacks \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayURL`].OutputValue' \
    --output text)

S3_BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text)

echo "S3 Bucket Domain: $S3_BUCKET_DOMAIN"
echo "API Gateway URL: $API_GATEWAY_URL"
echo "S3 Bucket Name: $S3_BUCKET_NAME"
echo ""

# Step 3: Deploy global stack (us-east-1)
echo "Step 3: Deploying global resources to $GLOBAL_REGION..."
GLOBAL_STACK_NAME="${PROJECT_NAME}-global"

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

aws cloudformation deploy \
    --template-file wa-visualizer-global.yaml \
    --stack-name "$GLOBAL_STACK_NAME" \
    --region "$GLOBAL_REGION" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        AllowedIPAddresses="$IP_ADDRESSES" \
        S3BucketDomainName="$S3_BUCKET_DOMAIN" \
        RegionalStackRegion="$REGIONAL_REGION" \
        AccountId="$ACCOUNT_ID" \
    --capabilities CAPABILITY_IAM \
    --tags \
        Project="$PROJECT_NAME" \
        Environment="$ENVIRONMENT"

echo "Global stack deployed successfully!"

# Get outputs from global stack
echo "Getting global stack outputs..."
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "$GLOBAL_STACK_NAME" \
    --region "$GLOBAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
    --output text)

CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
    --stack-name "$GLOBAL_STACK_NAME" \
    --region "$GLOBAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' \
    --output text)

echo ""
echo "Step 4: Uploading website files to S3..."

# Update the HTML file with the correct API Gateway URL
sed "s|YOUR_API_GATEWAY_URL_HERE|$API_GATEWAY_URL|g" wa-api-visualizer.html > wa-api-visualizer-updated.html

# Upload files to S3
aws s3 cp wa-api-visualizer-updated.html "s3://$S3_BUCKET_NAME/wa-api-visualizer.html" --region "$REGIONAL_REGION"
aws s3 cp script-improved.js "s3://$S3_BUCKET_NAME/script-improved.js" --region "$REGIONAL_REGION"

# Clean up temporary file
rm wa-api-visualizer-updated.html

echo "Website files uploaded successfully!"
echo ""

echo "🎉 Multi-region deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  Regional Stack ($REGIONAL_REGION): $REGIONAL_STACK_NAME"
echo "  Global Stack ($GLOBAL_REGION): $GLOBAL_STACK_NAME"
echo "  S3 Bucket: $S3_BUCKET_NAME"
echo "  API Gateway URL: $API_GATEWAY_URL"
echo "  CloudFront URL: $CLOUDFRONT_URL"
echo "  CloudFront Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID"
echo ""
echo "🌐 Access your application at: $CLOUDFRONT_URL"
echo ""
echo "⏰ Note: CloudFront distribution may take 5-15 minutes to fully propagate."
echo ""
echo "🔧 To manage IP addresses later, use:"
echo "  ./manage-ips-multi-region.sh --help"
