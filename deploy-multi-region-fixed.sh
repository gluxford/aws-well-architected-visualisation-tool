#!/bin/bash

# Multi-region deployment script for Well-Architected Visualizer
# Deploys regional resources to ap-southeast-2 and global resources to us-east-1

set -e

# Default values
PROJECT_NAME="wa-visualizer"
ENVIRONMENT="prod"
REGIONAL_REGION="ap-southeast-2"
GLOBAL_REGION="us-east-1"
AWS_PROFILE="cevo-production"

# Function to display usage
usage() {
    echo "Usage: $0 [--project-name NAME] [--environment ENV]"
    echo ""
    echo "Options:"
    echo "  --project-name    Project name prefix (default: wa-visualizer)"
    echo "  --environment     Environment name (default: prod)"
    echo ""
    echo "Example:"
    echo "  $0 --project-name my-wa-tool --environment dev"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --project-name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
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

# Set AWS profile
export AWS_PROFILE="$AWS_PROFILE"
echo "Using AWS profile: $AWS_PROFILE"

echo "Starting multi-region deployment..."
echo "Project: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Regional region: $REGIONAL_REGION"
echo "Global region: $GLOBAL_REGION"
echo "Authentication: Cognito (cevo.com.au emails only)"
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Step 1: Create Lambda S3 bucket and upload function
echo "Step 1: Creating Lambda S3 bucket and uploading function..."
LAMBDA_S3_BUCKET="${PROJECT_NAME}-lambda-${ACCOUNT_ID}-${REGIONAL_REGION}"

# Create Lambda S3 bucket if it doesn't exist
aws s3api head-bucket --bucket "$LAMBDA_S3_BUCKET" --region "$REGIONAL_REGION" 2>/dev/null || \
aws s3 mb "s3://$LAMBDA_S3_BUCKET" --region "$REGIONAL_REGION"

# Build Lambda function package
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
    -x "*.pyc" >/dev/null
cd ..

if [ ! -f "lambda-function.zip" ]; then
    echo "❌ Error: Failed to create lambda-function.zip"
    exit 1
fi

echo "✅ Lambda function package created successfully"

# Create timestamped S3 key to force CloudFormation update
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LAMBDA_S3_KEY="lambda-function-${TIMESTAMP}.zip"

# Upload Lambda function zip file
echo "Uploading Lambda function to s3://$LAMBDA_S3_BUCKET/$LAMBDA_S3_KEY..."
aws s3 cp lambda-function.zip "s3://$LAMBDA_S3_BUCKET/$LAMBDA_S3_KEY" --region "$REGIONAL_REGION"

# Step 2: Deploy regional stack
echo "Step 2: Deploying regional resources to $REGIONAL_REGION..."
REGIONAL_STACK_NAME="${PROJECT_NAME}-regional"

aws cloudformation deploy \
    --template-file wa-visualizer-regional-secure.yaml \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        LambdaS3Bucket="$LAMBDA_S3_BUCKET" \
        LambdaS3Key="$LAMBDA_S3_KEY" \
    --capabilities CAPABILITY_IAM \
    --tags \
        Project="$PROJECT_NAME" \
        Environment="$ENVIRONMENT"

echo "✅ Regional stack deployed successfully!"

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

USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
    --output text)

echo "S3 Bucket Domain: $S3_BUCKET_DOMAIN"
echo "API Gateway URL: $API_GATEWAY_URL"
echo "S3 Bucket Name: $S3_BUCKET_NAME"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo ""

# Step 3: Deploy global stack
echo "Step 3: Deploying global resources to $GLOBAL_REGION..."
GLOBAL_STACK_NAME="${PROJECT_NAME}-global"

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

echo "✅ Global stack deployed successfully!"

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

# Step 4: Upload website files
echo "Step 4: Uploading website files to S3..."

# Update the HTML file with the correct API Gateway URL
sed "s|YOUR_API_GATEWAY_URL_HERE|$API_GATEWAY_URL|g" wa-api-visualizer.html > wa-api-visualizer-updated.html

# Update the auth overlay with Cognito configuration
sed -e "s|UserPoolId: '.*'|UserPoolId: '$USER_POOL_ID'|g" \
    -e "s|ClientId: '.*'|ClientId: '$USER_POOL_CLIENT_ID'|g" \
    -e "s|Region: '.*'|Region: '$REGIONAL_REGION'|g" \
    auth-overlay.js > auth-overlay-updated.js

# Upload files to S3
aws s3 cp wa-api-visualizer-updated.html "s3://$S3_BUCKET_NAME/wa-api-visualizer.html" --region "$REGIONAL_REGION"
aws s3 cp script-improved.js "s3://$S3_BUCKET_NAME/script-improved.js" --region "$REGIONAL_REGION"
aws s3 cp auth-overlay-updated.js "s3://$S3_BUCKET_NAME/auth-overlay.js" --region "$REGIONAL_REGION"

# Clean up temporary files
rm wa-api-visualizer-updated.html
rm auth-overlay-updated.js
rm lambda-function.zip

echo "✅ Website files uploaded successfully!"
echo ""

echo "🎉 Multi-region deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "  Regional Stack ($REGIONAL_REGION): $REGIONAL_STACK_NAME"
echo "  Global Stack ($GLOBAL_REGION): $GLOBAL_STACK_NAME"
echo "  Lambda S3 Bucket: $LAMBDA_S3_BUCKET"
echo "  Website S3 Bucket: $S3_BUCKET_NAME"
echo "  API Gateway URL: $API_GATEWAY_URL"
echo "  CloudFront URL: $CLOUDFRONT_URL"
echo "  CloudFront Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID"
echo ""
echo "🌐 Access your application at: $CLOUDFRONT_URL"
echo ""
echo "⏰ Note: CloudFront distribution may take 5-15 minutes to fully propagate."
