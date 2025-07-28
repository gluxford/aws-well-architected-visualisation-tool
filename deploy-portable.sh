#!/bin/bash

# Portable Well-Architected Visualizer Deployment Script
# This script makes the solution deployable to any AWS account

set -e

# Configuration
PROJECT_NAME="wellarchitected-visualizer"
REGION=${AWS_DEFAULT_REGION:-"ap-southeast-2"}
STACK_NAME="${PROJECT_NAME}-proxy"
LAMBDA_FUNCTION_NAME="${PROJECT_NAME}-proxy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Well-Architected Visualizer Deployment${NC}"
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"
echo ""

# Function to check if AWS CLI is configured
check_aws_config() {
    echo -e "${BLUE}Checking AWS configuration...${NC}"
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        echo -e "${RED}❌ AWS CLI not configured or no valid credentials found${NC}"
        echo "Please run 'aws configure' or set up your AWS credentials"
        exit 1
    fi
    
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}✅ AWS configured for account: $ACCOUNT_ID${NC}"
}

# Function to deploy or update the Lambda function
deploy_lambda() {
    echo -e "${BLUE}Deploying Lambda function...${NC}"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION > /dev/null 2>&1; then
        echo "Stack exists, updating..."
        ACTION="update"
    else
        echo "Stack doesn't exist, creating..."
        ACTION="create"
    fi
    
    # Create deployment package
    cd lambda-proxy
    
    # Use the improved Lambda function if it exists, otherwise use the original
    if [ -f "lambda_function_improved.py" ]; then
        echo "Using improved Lambda function..."
        cp lambda_function_improved.py lambda_function.py
    fi
    
    # Create zip file
    zip -r function.zip . -x "*.git*" "*.DS_Store*" "deploy.sh" "README.md" "*.yaml"
    
    cd ..
    
    # Deploy using CloudFormation
    if [ "$ACTION" = "create" ]; then
        aws cloudformation create-stack \
            --stack-name $STACK_NAME \
            --template-body file://wa-visualizer-template.yaml \
            --capabilities CAPABILITY_IAM \
            --region $REGION \
            --parameters ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME
    else
        aws cloudformation update-stack \
            --stack-name $STACK_NAME \
            --template-body file://wa-visualizer-template.yaml \
            --capabilities CAPABILITY_IAM \
            --region $REGION \
            --parameters ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME
    fi
    
    echo "Waiting for stack deployment to complete..."
    aws cloudformation wait stack-${ACTION}-complete --stack-name $STACK_NAME --region $REGION
    
    echo -e "${GREEN}✅ Lambda function deployed successfully${NC}"
}

# Function to get the API endpoint
get_api_endpoint() {
    echo -e "${BLUE}Getting API Gateway endpoint...${NC}"
    
    API_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='WellArchitectedProxyApi'].OutputValue" \
        --output text)
    
    if [ -z "$API_ENDPOINT" ]; then
        echo -e "${RED}❌ Could not retrieve API endpoint${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ API Endpoint: $API_ENDPOINT${NC}"
}

# Function to update JavaScript files with the correct API endpoint
update_javascript() {
    echo -e "${BLUE}Updating JavaScript files with API endpoint...${NC}"
    
    # Update the improved script
    if [ -f "script-improved.js" ]; then
        sed -i.bak "s|const API_ENDPOINT = window.WA_API_ENDPOINT.*|const API_ENDPOINT = window.WA_API_ENDPOINT || '$API_ENDPOINT';|g" script-improved.js
        echo "Updated script-improved.js"
    fi
    
    # Update the complete script
    if [ -f "script-complete.js" ]; then
        sed -i.bak "s|const API_ENDPOINT = '.*';|const API_ENDPOINT = '$API_ENDPOINT';|g" script-complete.js
        echo "Updated script-complete.js"
    fi
    
    # Update any other script files
    for script_file in script*.js; do
        if [ -f "$script_file" ] && [ "$script_file" != "script-improved.js" ] && [ "$script_file" != "script-complete.js" ]; then
            if grep -q "API_ENDPOINT.*execute-api" "$script_file"; then
                sed -i.bak "s|const API_ENDPOINT = '.*';|const API_ENDPOINT = '$API_ENDPOINT';|g" "$script_file"
                echo "Updated $script_file"
            fi
        fi
    done
    
    echo -e "${GREEN}✅ JavaScript files updated${NC}"
}

# Function to deploy to S3 (if bucket exists)
deploy_to_s3() {
    echo -e "${BLUE}Checking for S3 website bucket...${NC}"
    
    # Try to find existing S3 bucket
    BUCKET_NAME=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'wa-report-visualiser') || contains(Name, 'wellarchitected-visualizer')].Name" --output text | head -1)
    
    if [ -n "$BUCKET_NAME" ]; then
        echo -e "${GREEN}Found S3 bucket: $BUCKET_NAME${NC}"
        echo "Uploading files to S3..."
        
        # Upload the improved script as the main script
        if [ -f "script-improved.js" ]; then
            aws s3 cp script-improved.js s3://$BUCKET_NAME/script.js --content-type "application/javascript"
            aws s3 cp script-improved.js s3://$BUCKET_NAME/script-improved.js --content-type "application/javascript"
        fi
        
        # Upload HTML files
        if [ -f "wa-api-visualizer.html" ]; then
            aws s3 cp wa-api-visualizer.html s3://$BUCKET_NAME/index.html --content-type "text/html"
        elif [ -f "wa-summary.html" ]; then
            aws s3 cp wa-summary.html s3://$BUCKET_NAME/index.html --content-type "text/html"
        fi
        
        # Upload CSS if it exists
        if [ -f "styles.css" ]; then
            aws s3 cp styles.css s3://$BUCKET_NAME/styles.css --content-type "text/css"
        fi
        
        # Get website URL
        WEBSITE_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
        
        # Try us-east-1 if the bucket is there
        if ! curl -s -I "$WEBSITE_URL" > /dev/null 2>&1; then
            WEBSITE_URL="http://$BUCKET_NAME.s3-website-us-east-1.amazonaws.com"
        fi
        
        echo -e "${GREEN}✅ Files uploaded to S3${NC}"
        echo -e "${GREEN}🌐 Website URL: $WEBSITE_URL${NC}"
    else
        echo -e "${YELLOW}⚠️  No S3 website bucket found. Files updated locally only.${NC}"
    fi
}

# Function to test the API
test_api() {
    echo -e "${BLUE}Testing API endpoint...${NC}"
    
    RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{"operation": "list_workloads", "params": {}}' \
        -w "HTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$RESPONSE" | sed 's/HTTP_STATUS:[0-9]*$//')
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ API test successful${NC}"
        WORKLOAD_COUNT=$(echo "$RESPONSE_BODY" | jq -r '.WorkloadSummaries | length' 2>/dev/null || echo "unknown")
        echo "Found $WORKLOAD_COUNT workloads"
    else
        echo -e "${RED}❌ API test failed (HTTP $HTTP_STATUS)${NC}"
        echo "Response: $RESPONSE_BODY"
    fi
}

# Function to display deployment summary
display_summary() {
    echo ""
    echo -e "${GREEN}🎉 Deployment Summary${NC}"
    echo "=================================="
    echo "Stack Name: $STACK_NAME"
    echo "Region: $REGION"
    echo "API Endpoint: $API_ENDPOINT"
    
    if [ -n "$WEBSITE_URL" ]; then
        echo "Website URL: $WEBSITE_URL"
    fi
    
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "1. Open the website URL in your browser"
    echo "2. Click 'List Available Workloads' to see your workloads"
    echo "3. Select a workload to generate a report"
    echo ""
    echo -e "${YELLOW}Note: If workloads show 'Unanswered' questions, complete the${NC}"
    echo -e "${YELLOW}Well-Architected review in the AWS console for full analysis.${NC}"
}

# Main execution
main() {
    check_aws_config
    deploy_lambda
    get_api_endpoint
    update_javascript
    deploy_to_s3
    test_api
    display_summary
}

# Run main function
main
