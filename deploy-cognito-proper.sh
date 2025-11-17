#!/bin/bash

# Deploy Well-Architected Visualizer with Cognito Authentication
# This script properly handles the S3 bucket creation and Lambda upload sequence

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

# Step 1: Create a placeholder Lambda function
echo "Creating placeholder Lambda function..."
mkdir -p temp
cat > temp/placeholder.py << 'EOF'
import json

def lambda_handler(event, context):
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
        },
        'body': json.dumps({'message': 'Placeholder function'})
    }
EOF

cd temp
zip placeholder.zip placeholder.py
cd ..

# Step 2: Deploy regional stack with placeholder Lambda
echo "Deploying regional stack with placeholder Lambda..."
aws cloudformation deploy \
    --template-file wa-visualizer-regional.yaml \
    --stack-name "${PROJECT_NAME}-regional" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        LambdaS3Key="placeholder.zip" \
        LambdaHandler="placeholder.lambda_handler" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGIONAL_REGION

# Step 3: Upload placeholder to S3
echo "Uploading placeholder Lambda to S3..."
aws s3 cp temp/placeholder.zip "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/placeholder.zip" --region $REGIONAL_REGION

# Step 4: Build and upload real Lambda function
echo "Building real Lambda function..."
cd lambda-proxy
zip -r ../lambda-function.zip . -x "*.pyc" "__pycache__/*"
cd ..

LAMBDA_S3_KEY="lambda-function-$(date +%s).zip"
echo "Uploading real Lambda function to S3..."
aws s3 cp lambda-function.zip "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/${LAMBDA_S3_KEY}" --region $REGIONAL_REGION

# Step 5: Update regional stack with real Lambda function
echo "Updating regional stack with real Lambda function..."
aws cloudformation deploy \
    --template-file wa-visualizer-regional.yaml \
    --stack-name "${PROJECT_NAME}-regional" \
    --parameter-overrides \
        ProjectName="$PROJECT_NAME" \
        Environment="$ENVIRONMENT" \
        LambdaS3Key="$LAMBDA_S3_KEY" \
        LambdaHandler="lambda_function_improved.lambda_handler" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGIONAL_REGION

# Step 6: Get outputs from regional stack
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

# Step 7: Deploy global stack (CloudFront without WAF)
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

# Step 8: Get CloudFront URL
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
    --stack-name "${PROJECT_NAME}-global" \
    --region $GLOBAL_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' \
    --output text)

echo "CloudFront URL: $CLOUDFRONT_URL"

# Step 9: Configure authentication in JavaScript files
echo "Configuring authentication..."

# Update auth-overlay.js with Cognito configuration
sed -i.bak "s/REPLACE_WITH_USER_POOL_ID/$USER_POOL_ID/g" auth-overlay.js
sed -i.bak "s/REPLACE_WITH_CLIENT_ID/$USER_POOL_CLIENT_ID/g" auth-overlay.js
sed -i.bak "s/REPLACE_WITH_REGION/$REGIONAL_REGION/g" auth-overlay.js

# Update script-improved.js with API URL
sed -i.bak "s|const API_ENDPOINT = .*|const API_ENDPOINT = '$API_URL/proxy';|g" script-improved.js

# Step 10: Upload web files to S3
echo "Uploading web files to S3..."
aws s3 cp wa-api-visualizer.html "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/" --region $REGIONAL_REGION
aws s3 cp auth-overlay.js "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/" --region $REGIONAL_REGION
aws s3 cp script-improved.js "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}/" --region $REGIONAL_REGION

# Restore original files
mv auth-overlay.js.bak auth-overlay.js
mv script-improved.js.bak script-improved.js

# Clean up
rm -rf temp lambda-function.zip

echo ""
echo "=========================================="
echo "Deployment completed successfully!"
echo "=========================================="
echo ""
echo "CloudFront URL: $CLOUDFRONT_URL"
echo "User Pool ID: $USER_POOL_ID"
echo "User Pool Client ID: $USER_POOL_CLIENT_ID"
echo ""
echo "Next steps:"
echo "1. Access the application at: $CLOUDFRONT_URL"
echo "2. Sign up with a @cevo.com.au email address"
echo "3. Set up MFA when prompted"
echo "4. Sign in and start using the Well-Architected visualizer"
echo ""
