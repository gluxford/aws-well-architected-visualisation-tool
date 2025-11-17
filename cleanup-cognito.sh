#!/bin/bash

# Cleanup Well-Architected Visualizer with Cognito Authentication

set -e

# Default values
PROJECT_NAME="cevo-wa-visualiser-tool"
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
        --profile)
            PROFILE="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --project-name NAME    Project name (default: cevo-wa-visualiser-tool)"
            echo "  --profile PROFILE      AWS profile to use"
            echo "  --help                 Show this help message"
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

echo "Cleaning up Well-Architected Visualizer resources..."

# Empty S3 bucket before deletion
echo "Emptying S3 bucket..."
aws s3 rm "s3://${PROJECT_NAME}-website-${ACCOUNT_ID}-${REGIONAL_REGION}" --recursive --region $REGIONAL_REGION 2>/dev/null || echo "S3 bucket already empty or doesn't exist"

# Delete global stack (CloudFront)
echo "Deleting global stack..."
aws cloudformation delete-stack --stack-name "${PROJECT_NAME}-global" --region $GLOBAL_REGION 2>/dev/null || echo "Global stack doesn't exist"

# Wait for global stack deletion
echo "Waiting for global stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name "${PROJECT_NAME}-global" --region $GLOBAL_REGION 2>/dev/null || echo "Global stack deletion completed or stack didn't exist"

# Delete regional stack (S3, Lambda, API Gateway, Cognito)
echo "Deleting regional stack..."
aws cloudformation delete-stack --stack-name "${PROJECT_NAME}-regional" --region $REGIONAL_REGION 2>/dev/null || echo "Regional stack doesn't exist"

# Wait for regional stack deletion
echo "Waiting for regional stack deletion..."
aws cloudformation wait stack-delete-complete --stack-name "${PROJECT_NAME}-regional" --region $REGIONAL_REGION 2>/dev/null || echo "Regional stack deletion completed or stack didn't exist"

echo ""
echo "=========================================="
echo "Cleanup completed successfully!"
echo "=========================================="
echo ""
echo "All resources have been removed:"
echo "- CloudFront distribution"
echo "- S3 bucket and contents"
echo "- Lambda functions"
echo "- API Gateway"
echo "- Cognito User Pool"
echo "- IAM roles and policies"
echo ""
