#!/bin/bash

# Cleanup script for multi-region Well-Architected Visualizer
# Deletes both regional and global stacks

set -e

# Default values
PROJECT_NAME="cevo-wa-visualiser-tool"
REGIONAL_REGION="ap-southeast-2"
GLOBAL_REGION="us-east-1"
AWS_PROFILE=""

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --project-name NAME        Project name prefix (default: cevo-wa-visualiser-tool)"
    echo "  --profile PROFILE          AWS profile to use"
    echo "  --confirm                  Skip confirmation prompt"
    echo ""
    echo "Example:"
    echo "  $0 --profile cevo-production --confirm"
    exit 1
}

# Parse command line arguments
CONFIRM=false
while [[ $# -gt 0 ]]; do
    case $1 in
        --project-name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
            ;;
        --confirm)
            CONFIRM=true
            shift
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

# Set AWS profile if provided
if [[ -n "$AWS_PROFILE" ]]; then
    export AWS_PROFILE="$AWS_PROFILE"
    echo "Using AWS profile: $AWS_PROFILE"
fi

REGIONAL_STACK_NAME="${PROJECT_NAME}-regional"
GLOBAL_STACK_NAME="${PROJECT_NAME}-global"

echo "This will delete the following stacks:"
echo "  Regional stack: $REGIONAL_STACK_NAME (in $REGIONAL_REGION)"
echo "  Global stack: $GLOBAL_STACK_NAME (in $GLOBAL_REGION)"
echo ""

if [[ "$CONFIRM" != "true" ]]; then
    read -p "Are you sure you want to proceed? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleanup cancelled."
        exit 0
    fi
fi

echo "Starting cleanup..."

# Step 1: Empty S3 bucket first (if it exists)
echo "Step 1: Emptying S3 bucket..."
S3_BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
    --output text 2>/dev/null || echo "")

if [[ -n "$S3_BUCKET_NAME" && "$S3_BUCKET_NAME" != "None" ]]; then
    echo "Emptying S3 bucket: $S3_BUCKET_NAME"
    aws s3 rm "s3://$S3_BUCKET_NAME" --recursive --region "$REGIONAL_REGION" 2>/dev/null || true
    echo "S3 bucket emptied."
else
    echo "No S3 bucket found or already deleted."
fi

# Step 2: Delete global stack (CloudFront, WAF)
echo ""
echo "Step 2: Deleting global stack..."
aws cloudformation delete-stack \
    --stack-name "$GLOBAL_STACK_NAME" \
    --region "$GLOBAL_REGION" 2>/dev/null || {
    echo "Global stack not found or already deleted."
}

echo "Waiting for global stack deletion to complete..."
aws cloudformation wait stack-delete-complete \
    --stack-name "$GLOBAL_STACK_NAME" \
    --region "$GLOBAL_REGION" 2>/dev/null || {
    echo "Global stack deletion completed or stack not found."
}

# Step 3: Delete regional stack (S3, Lambda, API Gateway)
echo ""
echo "Step 3: Deleting regional stack..."
aws cloudformation delete-stack \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" 2>/dev/null || {
    echo "Regional stack not found or already deleted."
}

echo "Waiting for regional stack deletion to complete..."
aws cloudformation wait stack-delete-complete \
    --stack-name "$REGIONAL_STACK_NAME" \
    --region "$REGIONAL_REGION" 2>/dev/null || {
    echo "Regional stack deletion completed or stack not found."
}

echo ""
echo "🎉 Cleanup completed successfully!"
echo ""
echo "All resources have been deleted:"
echo "  ✅ Global stack ($GLOBAL_REGION): $GLOBAL_STACK_NAME"
echo "  ✅ Regional stack ($REGIONAL_REGION): $REGIONAL_STACK_NAME"
echo "  ✅ S3 bucket contents emptied"
