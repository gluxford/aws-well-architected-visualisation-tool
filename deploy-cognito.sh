#!/bin/bash

# Deploy Well-Architected Visualizer with Cognito Authentication
# This script replaces IP-based authentication with Cognito email domain restriction

set -e

# Default values
PROJECT_NAME="cevo-wa-visualiser-tool"
ENVIRONMENT="prod"
PROFILE=""
REGIONAL_REGION="ap-southeast-2"
GLOBAL_REGION="us-east-1"

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
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-name NAME    Project name (default: cevo-wa-visualiser-tool)"
            echo "  --environment ENV      Environment (default: prod)"
            echo "  --profile PROFILE      AWS profile to use"
            echo "  --help                 Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --profile cevo-production"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set AWS profile if provided
if [ ! -z "$PROFILE" ]; then
    export AWS_PROFILE="$PROFILE"
    echo "Using AWS profile: $PROFILE"
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account ID: $ACCOUNT_ID"

# Build Lambda function
echo "Building Lambda function..."
cd lambda-proxy
zip -r ../lambda-function.zip . -x "*.pyc" "__pycache__/*"
cd ..

# Upload Lambda function to S3 (regional bucket)
LAMBDA_S3_KEY="lambda-function-$(date +%s).zip"
echo "Uploading Lambda function to S3..."
aws s3 cp lambda-function.zip "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/${LAMBDA_S3_KEY}" --region $REGIONAL_REGION

# Deploy regional stack (includes Cognito)
echo "Deploying regional stack with Cognito..."
aws cloudformation deploy \
    --template-file wa-visualizer-regional.yaml \
    --stack-name "${PROJECT_NAME}-regional" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        LambdaS3Key="$LAMBDA_S3_KEY" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGIONAL_REGION

# Get outputs from regional stack
echo "Getting regional stack outputs..."
REGIONAL_OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-regional" \
    --region $REGIONAL_REGION \
    --query 'Stacks[0].Outputs')

S3_BUCKET_DOMAIN=$(echo $REGIONAL_OUTPUTS | jq -r '.[] | select(.OutputKey=="S3BucketRegionalDomainName") | .OutputValue')
API_URL=$(echo $REGIONAL_OUTPUTS | jq -r '.[] | select(.OutputKey=="ApiGatewayURL") | .OutputValue')
USER_POOL_ID=$(echo $REGIONAL_OUTPUTS | jq -r '.[] | select(.OutputKey=="UserPoolId") | .OutputValue')
USER_POOL_CLIENT_ID=$(echo $REGIONAL_OUTPUTS | jq -r '.[] | select(.OutputKey=="UserPoolClientId") | .OutputValue')

echo "S3 Bucket Domain: $S3_BUCKET_DOMAIN"
echo "API URL: $API_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"

# Deploy global stack (CloudFront without WAF)
echo "Deploying global stack..."
aws cloudformation deploy \
    --template-file wa-visualizer-global.yaml \
    --stack-name "${PROJECT_NAME}-global" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        S3BucketDomainName="$S3_BUCKET_DOMAIN" \
        RegionalStackRegion="$REGIONAL_REGION" \
        AccountId="$ACCOUNT_ID" \
        UserPoolId="$USER_POOL_ID" \
        UserPoolClientId="$USER_POOL_CLIENT_ID" \
    --region $GLOBAL_REGION

# Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-global" \
    --region $GLOBAL_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
    --output text)

echo "CloudFront URL: $CLOUDFRONT_URL"

# Configure authentication in JavaScript files
echo "Configuring authentication..."

# Update auth-overlay.js with Cognito configuration
sed -i.bak "s/REPLACE_WITH_USER_POOL_ID/$USER_POOL_ID/g" auth-overlay.js
sed -i.bak "s/REPLACE_WITH_CLIENT_ID/$USER_POOL_CLIENT_ID/g" auth-overlay.js
sed -i.bak "s/REPLACE_WITH_REGION/$REGIONAL_REGION/g" auth-overlay.js

# Update script-improved.js with API URL
sed -i.bak "s|const API_ENDPOINT = .*|const API_ENDPOINT = '$API_URL/proxy';|g" script-improved.js

# Upload web files to S3
echo "Uploading web files to S3..."
aws s3 cp wa-api-visualizer.html "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/" --region $REGIONAL_REGION
aws s3 cp auth-overlay.js "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/" --region $REGIONAL_REGION
aws s3 cp script-improved.js "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/" --region $REGIONAL_REGION

# Restore original files
mv auth-overlay.js.bak auth-overlay.js
mv script-improved.js.bak script-improved.js

# Clean up
rm -f lambda-function.zip

echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Application URL: $CLOUDFRONT_URL"
echo ""
echo "Authentication Details:"
echo "- Only @cevo.com.au email addresses can sign up"
echo "- Users will be auto-confirmed upon registration"
echo "- Sign in with email and password"
echo ""
echo "Note: CloudFront distribution may take 5-15 minutes to fully propagate."
echo "If you get access denied errors initially, please wait and try again."
echo ""
