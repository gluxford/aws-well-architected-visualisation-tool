#!/bin/bash

# Cleanup script for Well-Architected Visualizer multi-region deployment

set -e

# Default values
PROJECT_NAME="wa-visualizer"
ENVIRONMENT="prod"
REGIONAL_REGION="ap-southeast-2"
GLOBAL_REGION="us-east-1"
AWS_PROFILE="cevo-production"

# Set AWS profile
export AWS_PROFILE="$AWS_PROFILE"
echo "Using AWS profile: $AWS_PROFILE"

echo "Starting cleanup of Well-Architected Visualizer resources..."
echo "Project: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo ""

# Get AWS Account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Stack names
REGIONAL_STACK_NAME="${PROJECT_NAME}-regional"
GLOBAL_STACK_NAME="${PROJECT_NAME}-global"

# S3 bucket names
LAMBDA_S3_BUCKET="${PROJECT_NAME}-lambda-${ACCOUNT_ID}-${REGIONAL_REGION}"
WEBSITE_S3_BUCKET="${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}"

echo "Step 1: Emptying S3 buckets..."

# Empty Lambda S3 bucket
if aws s3api head-bucket --bucket "$LAMBDA_S3_BUCKET" --region "$REGIONAL_REGION" 2>/dev/null; then
    echo "Emptying Lambda S3 bucket: $LAMBDA_S3_BUCKET"
    aws s3 rm "s3://$LAMBDA_S3_BUCKET" --recursive --region "$REGIONAL_REGION"
else
    echo "Lambda S3 bucket $LAMBDA_S3_BUCKET does not exist or is not accessible"
fi

# Empty Website S3 bucket
if aws s3api head-bucket --bucket "$WEBSITE_S3_BUCKET" --region "$REGIONAL_REGION" 2>/dev/null; then
    echo "Emptying Website S3 bucket: $WEBSITE_S3_BUCKET"
    aws s3 rm "s3://$WEBSITE_S3_BUCKET" --recursive --region "$REGIONAL_REGION"
else
    echo "Website S3 bucket $WEBSITE_S3_BUCKET does not exist or is not accessible"
fi

echo "Step 2: Deleting CloudFormation stacks..."

# Delete global stack first (CloudFront, WAF)
echo "Deleting global stack: $GLOBAL_STACK_NAME"
if aws cloudformation describe-stacks --stack-name "$GLOBAL_STACK_NAME" --region "$GLOBAL_REGION" >/dev/null 2>&1; then
    aws cloudformation delete-stack --stack-name "$GLOBAL_STACK_NAME" --region "$GLOBAL_REGION"
    echo "Waiting for global stack deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name "$GLOBAL_STACK_NAME" --region "$GLOBAL_REGION"
    echo "✅ Global stack deleted successfully"
else
    echo "Global stack $GLOBAL_STACK_NAME does not exist"
fi

# Delete regional stack
echo "Deleting regional stack: $REGIONAL_STACK_NAME"
if aws cloudformation describe-stacks --stack-name "$REGIONAL_STACK_NAME" --region "$REGIONAL_REGION" >/dev/null 2>&1; then
    aws cloudformation delete-stack --stack-name "$REGIONAL_STACK_NAME" --region "$REGIONAL_REGION"
    echo "Waiting for regional stack deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name "$REGIONAL_STACK_NAME" --region "$REGIONAL_REGION"
    echo "✅ Regional stack deleted successfully"
else
    echo "Regional stack $REGIONAL_STACK_NAME does not exist"
fi

echo "Step 3: Deleting S3 buckets..."

# Delete Lambda S3 bucket
if aws s3api head-bucket --bucket "$LAMBDA_S3_BUCKET" --region "$REGIONAL_REGION" 2>/dev/null; then
    echo "Deleting Lambda S3 bucket: $LAMBDA_S3_BUCKET"
    aws s3 rb "s3://$LAMBDA_S3_BUCKET" --region "$REGIONAL_REGION"
    echo "✅ Lambda S3 bucket deleted"
else
    echo "Lambda S3 bucket $LAMBDA_S3_BUCKET already deleted or does not exist"
fi

echo ""
echo "🎉 Cleanup completed successfully!"
echo ""
echo "All resources for project '$PROJECT_NAME' have been removed."
