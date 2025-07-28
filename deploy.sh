#!/bin/bash

# Configuration
DEPLOYMENT_BUCKET="wa-visualizer-deployment-$(aws sts get-caller-identity --query 'Account' --output text)"
REGION="us-east-1"
STACK_NAME="wa-visualizer"
WEBSITE_BUCKET="wa-visualizer-website-$(aws sts get-caller-identity --query 'Account' --output text)"
PROJECT_NAME="wellarchitectedsummary"
ENVIRONMENT="prod"
CREATE_CLOUDFRONT="true"
LAMBDA_FUNCTION_NAME="wellarchitected-proxy"
API_GATEWAY_NAME="WellArchitectedProxyApi"
API_STAGE_NAME="prod"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --region)
      REGION="$2"
      shift 2
      ;;
    --stack-name)
      STACK_NAME="$2"
      shift 2
      ;;
    --deployment-bucket)
      DEPLOYMENT_BUCKET="$2"
      shift 2
      ;;
    --website-bucket)
      WEBSITE_BUCKET="$2"
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
    --cloudfront)
      CREATE_CLOUDFRONT="$2"
      shift 2
      ;;
    --lambda-name)
      LAMBDA_FUNCTION_NAME="$2"
      shift 2
      ;;
    --api-name)
      API_GATEWAY_NAME="$2"
      shift 2
      ;;
    --api-stage)
      API_STAGE_NAME="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "Deploying Well-Architected Report Visualizer"
echo "============================================"
echo "Region: $REGION"
echo "Stack name: $STACK_NAME"
echo "Deployment bucket: $DEPLOYMENT_BUCKET"
echo "Website bucket: $WEBSITE_BUCKET"
echo "Project name: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Create CloudFront: $CREATE_CLOUDFRONT"
echo "Lambda function name: $LAMBDA_FUNCTION_NAME"
echo "API Gateway name: $API_GATEWAY_NAME"
echo "API stage name: $API_STAGE_NAME"
echo "============================================"

# Create deployment bucket if it doesn't exist
echo "Creating deployment bucket if it doesn't exist..."
aws s3api head-bucket --bucket $DEPLOYMENT_BUCKET 2>/dev/null || aws s3 mb s3://$DEPLOYMENT_BUCKET --region $REGION

# Create templates directory in the deployment bucket
echo "Creating templates directory in deployment bucket..."
aws s3api put-object --bucket $DEPLOYMENT_BUCKET --key templates/ --content-length 0

# Upload CloudFormation templates
echo "Uploading CloudFormation templates..."
aws s3 cp wa-visualizer-infra.yaml s3://$DEPLOYMENT_BUCKET/templates/ --region $REGION
aws s3 cp wa-visualizer-lambda.yaml s3://$DEPLOYMENT_BUCKET/templates/ --region $REGION
aws s3 cp wa-visualizer-content.yaml s3://$DEPLOYMENT_BUCKET/templates/ --region $REGION
aws s3 cp wa-visualizer-master.yaml s3://$DEPLOYMENT_BUCKET/templates/ --region $REGION

# Upload web content to deployment bucket
echo "Uploading web content to deployment bucket..."
aws s3 cp wa-summary.html s3://$DEPLOYMENT_BUCKET/ --region $REGION
aws s3 cp script.js s3://$DEPLOYMENT_BUCKET/ --region $REGION
aws s3 cp styles.css s3://$DEPLOYMENT_BUCKET/ --region $REGION

# Deploy the CloudFormation stack
echo "Deploying CloudFormation stack..."
aws cloudformation deploy \
  --template-url https://$DEPLOYMENT_BUCKET.s3.amazonaws.com/templates/wa-visualizer-master.yaml \
  --stack-name $STACK_NAME \
  --parameter-overrides \
    ProjectName=$PROJECT_NAME \
    Environment=$ENVIRONMENT \
    WebsiteBucketName=$WEBSITE_BUCKET \
    DeploymentBucketName=$DEPLOYMENT_BUCKET \
    CreateCloudFrontDistribution=$CREATE_CLOUDFRONT \
    LambdaFunctionName=$LAMBDA_FUNCTION_NAME \
    ApiGatewayName=$API_GATEWAY_NAME \
    ApiStageName=$API_STAGE_NAME \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $REGION

# Get outputs
echo "Getting stack outputs..."
WEBSITE_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" --output text --region $REGION)
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text --region $REGION)

if [ "$CREATE_CLOUDFRONT" = "true" ]; then
  CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDomainName'].OutputValue" --output text --region $REGION)
  echo "CloudFront URL: https://$CLOUDFRONT_URL"
fi

echo "Deployment complete!"
echo "Website URL: $WEBSITE_URL"
echo "API Endpoint: $API_ENDPOINT"
