#!/bin/bash

# Well-Architected Visualizer Deployment Script with Multiple IP Support
# This script supports adding multiple IP addresses for access control

set -e

# Configuration
PROJECT_NAME="wa-visualizer"
REGION=${AWS_DEFAULT_REGION:-"ap-southeast-2"}
STACK_NAME="${PROJECT_NAME}-multi-ip"
ENVIRONMENT="prod"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --ip-addresses \"IP1/32,IP2/32\"  Comma-separated list of IP addresses in CIDR format"
    echo "  --region REGION                  AWS region (default: ap-southeast-2)"
    echo "  --project-name NAME              Project name (default: wa-visualizer)"
    echo "  --environment ENV                Environment (dev/test/prod, default: prod)"
    echo "  --profile PROFILE                AWS profile name (for SSO or named profiles)"
    echo "  --help                          Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Single IP address:"
    echo "  $0 --ip-addresses \"203.0.113.45/32\""
    echo ""
    echo "  # Multiple IP addresses:"
    echo "  $0 --ip-addresses \"203.0.113.45/32,198.51.100.10/32,192.0.2.100/32\""
    echo ""
    echo "  # Office network range:"
    echo "  $0 --ip-addresses \"203.0.113.0/24\""
    echo ""
    echo "  # With AWS SSO profile:"
    echo "  $0 --ip-addresses \"203.0.113.45/32\" --profile my-sso-profile"
    echo ""
    echo "To get your current IP address:"
    echo "  curl -s https://checkip.amazonaws.com"
    exit 1
}

# Parse command line arguments
ALLOWED_IPS=""
AWS_PROFILE_PARAM=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --ip-addresses)
            ALLOWED_IPS="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --project-name)
            PROJECT_NAME="$2"
            STACK_NAME="${PROJECT_NAME}-multi-ip"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE_PARAM="--profile $2"
            export AWS_PROFILE="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate required parameters
if [ -z "$ALLOWED_IPS" ]; then
    echo -e "${RED}❌ Error: IP addresses are required${NC}"
    echo ""
    echo "Your current IP address is:"
    CURRENT_IP=$(curl -s https://checkip.amazonaws.com)
    echo "$CURRENT_IP"
    echo ""
    echo "Use this IP with /32 suffix: $CURRENT_IP/32"
    echo ""
    usage
fi

# Validate CIDR format for each IP
IFS=',' read -ra IP_ARRAY <<< "$ALLOWED_IPS"
for ip in "${IP_ARRAY[@]}"; do
    ip=$(echo "$ip" | xargs)  # Trim whitespace
    if ! echo "$ip" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$'; then
        echo -e "${RED}❌ Error: Invalid CIDR format for IP: $ip${NC}"
        echo "Use format like 203.0.113.45/32"
        exit 1
    fi
done

echo -e "${BLUE}🚀 Starting Well-Architected Visualizer Deployment (Multi-IP)${NC}"
echo "Region: $REGION"
echo "Stack Name: $STACK_NAME"
echo "Project Name: $PROJECT_NAME"
echo "Environment: $ENVIRONMENT"
echo "Allowed IPs: $ALLOWED_IPS"
echo "Python Runtime: 3.13 (latest)"
echo "boto3 Version: 1.39.15 (latest)"
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

# Function to check if template exists
check_template() {
    echo -e "${BLUE}Checking CloudFormation template...${NC}"
    if [ ! -f "wa-visualizer-multi-ip.yaml" ]; then
        echo -e "${RED}❌ CloudFormation template 'wa-visualizer-multi-ip.yaml' not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ CloudFormation template found${NC}"
}

# Function to deploy the stack
deploy_stack() {
    echo -e "${BLUE}Deploying CloudFormation stack...${NC}"
    
    # Check if stack exists
    if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION > /dev/null 2>&1; then
        echo "Stack exists, updating..."
        ACTION="update"
        WAIT_CONDITION="stack-update-complete"
    else
        echo "Stack doesn't exist, creating..."
        ACTION="create"
        WAIT_CONDITION="stack-create-complete"
    fi
    
    # Deploy using CloudFormation
    if [ "$ACTION" = "create" ]; then
        aws cloudformation create-stack \
            --stack-name $STACK_NAME \
            --template-body file://wa-visualizer-multi-ip.yaml \
            --capabilities CAPABILITY_NAMED_IAM \
            --region $REGION \
            --parameters \
                ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME \
                ParameterKey=AllowedIPAddresses,ParameterValue=\"$ALLOWED_IPS\" \
                ParameterKey=Environment,ParameterValue=$ENVIRONMENT
    else
        aws cloudformation update-stack \
            --stack-name $STACK_NAME \
            --template-body file://wa-visualizer-multi-ip.yaml \
            --capabilities CAPABILITY_NAMED_IAM \
            --region $REGION \
            --parameters \
                ParameterKey=ProjectName,ParameterValue=$PROJECT_NAME \
                ParameterKey=AllowedIPAddresses,ParameterValue=\"$ALLOWED_IPS\" \
                ParameterKey=Environment,ParameterValue=$ENVIRONMENT
    fi
    
    echo "Waiting for stack deployment to complete..."
    aws cloudformation wait $WAIT_CONDITION --stack-name $STACK_NAME --region $REGION
    
    echo -e "${GREEN}✅ CloudFormation stack deployed successfully${NC}"
}

# Function to get stack outputs
get_stack_outputs() {
    echo -e "${BLUE}Getting stack outputs...${NC}"
    
    WEBSITE_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='WebsiteURL'].OutputValue" \
        --output text)
    
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayURL'].OutputValue" \
        --output text)
    
    S3_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" \
        --output text)
    
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
        --output text)
    
    echo -e "${GREEN}✅ Stack outputs retrieved${NC}"
}

# Function to upload website files
upload_website_files() {
    echo -e "${BLUE}Uploading website files to S3...${NC}"
    
    # Update JavaScript with API endpoint
    if [ -f "script-improved.js" ]; then
        # Create a temporary copy with updated API endpoint
        sed "s|const API_ENDPOINT = window.WA_API_ENDPOINT.*|const API_ENDPOINT = window.WA_API_ENDPOINT || '$API_URL';|g" script-improved.js > script-temp.js
        aws s3 cp script-temp.js s3://$S3_BUCKET/script.js --content-type "application/javascript"
        rm script-temp.js
        echo "Uploaded script-improved.js as script.js"
    fi
    
    # Upload HTML file
    if [ -f "wa-api-visualizer.html" ]; then
        aws s3 cp wa-api-visualizer.html s3://$S3_BUCKET/wa-api-visualizer.html --content-type "text/html"
        aws s3 cp wa-api-visualizer.html s3://$S3_BUCKET/index.html --content-type "text/html"
        echo "Uploaded wa-api-visualizer.html"
    fi
    
    # Upload CSS if it exists
    if [ -f "styles.css" ]; then
        aws s3 cp styles.css s3://$S3_BUCKET/styles.css --content-type "text/css"
        echo "Uploaded styles.css"
    fi
    
    echo -e "${GREEN}✅ Website files uploaded${NC}"
}

# Function to invalidate CloudFront cache
invalidate_cloudfront() {
    echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
    
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id $CLOUDFRONT_ID \
        --paths "/*" \
        --query "Invalidation.Id" \
        --output text)
    
    echo "CloudFront invalidation created: $INVALIDATION_ID"
    echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
}

# Function to test the API
test_api() {
    echo -e "${BLUE}Testing API endpoint...${NC}"
    
    RESPONSE=$(curl -s -X GET "$API_URL/workloads" \
        -H "Content-Type: application/json" \
        -w "HTTP_STATUS:%{http_code}")
    
    HTTP_STATUS=$(echo "$RESPONSE" | grep -o "HTTP_STATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo -e "${GREEN}✅ API test successful${NC}"
    else
        echo -e "${YELLOW}⚠️  API test returned HTTP $HTTP_STATUS${NC}"
        echo "This might be normal if you don't have any Well-Architected workloads yet"
    fi
}

# Function to display current IP addresses
show_current_ips() {
    echo -e "${BLUE}📋 Current Allowed IP Addresses:${NC}"
    IFS=',' read -ra IP_ARRAY <<< "$ALLOWED_IPS"
    for ip in "${IP_ARRAY[@]}"; do
        ip=$(echo "$ip" | xargs)  # Trim whitespace
        echo "  • $ip"
    done
    echo ""
}

# Function to display deployment summary
display_summary() {
    echo ""
    echo -e "${GREEN}🎉 Deployment Complete!${NC}"
    echo "=================================="
    echo "Stack Name: $STACK_NAME"
    echo "Region: $REGION"
    echo "Project Name: $PROJECT_NAME"
    echo "Environment: $ENVIRONMENT"
    echo ""
    show_current_ips
    echo -e "${BLUE}📋 Resources Created:${NC}"
    echo "Website URL: $WEBSITE_URL"
    echo "API Gateway URL: $API_URL"
    echo "S3 Bucket: $S3_BUCKET"
    echo "CloudFront Distribution ID: $CLOUDFRONT_ID"
    echo ""
    echo -e "${BLUE}🌐 Access Your Application:${NC}"
    echo "Open this URL in your browser: $WEBSITE_URL"
    echo ""
    echo -e "${YELLOW}📝 Important Notes:${NC}"
    echo "• The website is restricted to the specified IP addresses"
    echo "• CloudFront may take 5-15 minutes to fully propagate changes"
    echo ""
    echo -e "${BLUE}🔧 Adding More IP Addresses:${NC}"
    echo "To add more IP addresses, run:"
    echo "./deploy-multi-ip.sh --ip-addresses \"$ALLOWED_IPS,NEW_IP/32\""
    echo ""
    echo -e "${BLUE}🔧 Next Steps:${NC}"
    echo "1. Open the website URL in your browser"
    echo "2. Click 'List Available Workloads' to see your workloads"
    echo "3. Select a workload to generate a report"
    echo ""
    echo -e "${YELLOW}💡 Tip: If you don't see any workloads, create one in the AWS${NC}"
    echo -e "${YELLOW}Well-Architected Tool console first.${NC}"
}

# Main execution
main() {
    check_aws_config
    check_template
    deploy_stack
    get_stack_outputs
    upload_website_files
    invalidate_cloudfront
    test_api
    display_summary
}

# Run main function
main
