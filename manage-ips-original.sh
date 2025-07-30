#!/bin/bash

# IP Address Management Script for Well-Architected Visualizer
# This script helps you add, remove, or list IP addresses after deployment

set -e

# Configuration
PROJECT_NAME="wa-visualizer"
REGION=${AWS_DEFAULT_REGION:-"ap-southeast-2"}
STACK_NAME=""  # Will be determined automatically

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  list                    List current allowed IP addresses"
    echo "  add IP/32               Add a new IP address"
    echo "  remove IP/32            Remove an IP address"
    echo "  replace \"IP1/32,IP2/32\" Replace all IP addresses"
    echo "  current                 Show your current public IP"
    echo ""
    echo "Options:"
    echo "  --region REGION         AWS region (default: ap-southeast-2)"
    echo "  --stack-name NAME       CloudFormation stack name (auto-detected if not specified)"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 current                           # Show your current IP"
    echo "  $0 list                              # List allowed IPs"
    echo "  $0 add 203.0.113.45/32              # Add a new IP"
    echo "  $0 remove 203.0.113.45/32           # Remove an IP"
    echo "  $0 replace \"203.0.113.45/32,198.51.100.10/32\"  # Replace all IPs"
    exit 1
}

# Parse command line arguments
COMMAND=""
IP_VALUE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        list|add|remove|replace|current)
            COMMAND="$1"
            if [[ "$1" == "add" || "$1" == "remove" || "$1" == "replace" ]]; then
                IP_VALUE="$2"
                shift 2
            else
                shift 1
            fi
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --stack-name)
            STACK_NAME="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            if [ -z "$COMMAND" ]; then
                echo "Unknown command: $1"
                usage
            else
                echo "Unknown option: $1"
                usage
            fi
            ;;
    esac
done

if [ -z "$COMMAND" ]; then
    usage
fi

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity > /dev/null 2>&1; then
        echo -e "${RED}❌ AWS CLI not configured or no valid credentials found${NC}"
        exit 1
    fi
}

# Function to detect stack type and set stack name
detect_stack() {
    echo -e "${BLUE}Detecting deployment type...${NC}"
    
    # Check for multi-ip stack first
    if aws cloudformation describe-stacks --stack-name "${PROJECT_NAME}-multi-ip" --region $REGION > /dev/null 2>&1; then
        STACK_NAME="${PROJECT_NAME}-multi-ip"
        DEPLOYMENT_TYPE="standard"
        echo "Found standard deployment stack: $STACK_NAME"
    # Check for container stack
    elif aws cloudformation describe-stacks --stack-name "${PROJECT_NAME}-container" --region $REGION > /dev/null 2>&1; then
        STACK_NAME="${PROJECT_NAME}-container"
        DEPLOYMENT_TYPE="container"
        echo "Found container deployment stack: $STACK_NAME"
    else
        echo -e "${RED}❌ No Well-Architected Visualizer stack found${NC}"
        echo "Looked for:"
        echo "  • ${PROJECT_NAME}-multi-ip (standard deployment)"
        echo "  • ${PROJECT_NAME}-container (container deployment)"
        echo ""
        echo "Make sure you've deployed the solution first using:"
        echo "  • ./deploy-multi-ip.sh (for standard deployment)"
        echo "  • ./deploy-container.sh (for container deployment)"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Using $DEPLOYMENT_TYPE deployment: $STACK_NAME${NC}"
}

# Function to check if stack exists
check_stack_exists() {
    if [ -z "$STACK_NAME" ]; then
        detect_stack
    fi
    
    if ! aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION > /dev/null 2>&1; then
        echo -e "${RED}❌ CloudFormation stack '$STACK_NAME' not found in region $REGION${NC}"
        exit 1
    fi
}

# Function to get current IP addresses from stack
get_current_ips() {
    CURRENT_IPS=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Parameters[?ParameterKey=='AllowedIPAddresses'].ParameterValue" \
        --output text)
    
    if [ -z "$CURRENT_IPS" ]; then
        echo -e "${RED}❌ Could not retrieve current IP addresses from stack${NC}"
        exit 1
    fi
}

# Function to validate CIDR format
validate_cidr() {
    local ip="$1"
    if ! echo "$ip" | grep -qE '^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$'; then
        echo -e "${RED}❌ Error: Invalid CIDR format: $ip${NC}"
        echo "Use format like 203.0.113.45/32"
        exit 1
    fi
}

# Function to update stack with new IP addresses
update_stack() {
    local new_ips="$1"
    echo -e "${BLUE}Updating CloudFormation stack with new IP addresses...${NC}"
    
    aws cloudformation update-stack \
        --stack-name $STACK_NAME \
        --use-previous-template \
        --capabilities CAPABILITY_NAMED_IAM \
        --region $REGION \
        --parameters \
            ParameterKey=AllowedIPAddresses,ParameterValue=\"$new_ips\" \
            ParameterKey=ProjectName,UsePreviousValue=true \
            ParameterKey=Environment,UsePreviousValue=true
    
    echo "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete --stack-name $STACK_NAME --region $REGION
    
    echo -e "${GREEN}✅ Stack updated successfully${NC}"
    
    # Invalidate CloudFront cache
    CLOUDFRONT_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
        --output text)
    
    if [ -n "$CLOUDFRONT_ID" ]; then
        echo -e "${BLUE}Invalidating CloudFront cache...${NC}"
        aws cloudfront create-invalidation \
            --distribution-id $CLOUDFRONT_ID \
            --paths "/*" > /dev/null
        echo -e "${GREEN}✅ CloudFront cache invalidated${NC}"
    fi
}

# Function to show current public IP
show_current_ip() {
    echo -e "${BLUE}Your current public IP address:${NC}"
    CURRENT_IP=$(curl -s https://checkip.amazonaws.com)
    echo "$CURRENT_IP"
    echo ""
    echo "To add this IP to your allowed list:"
    echo "$0 add $CURRENT_IP/32"
}

# Function to list current allowed IPs
list_ips() {
    check_aws_config
    check_stack_exists
    get_current_ips
    
    echo -e "${BLUE}Current allowed IP addresses:${NC}"
    IFS=',' read -ra IP_ARRAY <<< "$CURRENT_IPS"
    for ip in "${IP_ARRAY[@]}"; do
        ip=$(echo "$ip" | xargs)  # Trim whitespace
        echo "  • $ip"
    done
}

# Function to add an IP address
add_ip() {
    local new_ip="$1"
    validate_cidr "$new_ip"
    
    check_aws_config
    check_stack_exists
    get_current_ips
    
    # Check if IP already exists
    if echo "$CURRENT_IPS" | grep -q "$new_ip"; then
        echo -e "${YELLOW}⚠️  IP address $new_ip is already in the allowed list${NC}"
        return
    fi
    
    # Add the new IP
    NEW_IPS="$CURRENT_IPS,$new_ip"
    echo -e "${BLUE}Adding IP address: $new_ip${NC}"
    update_stack "$NEW_IPS"
    echo -e "${GREEN}✅ IP address $new_ip added successfully${NC}"
}

# Function to remove an IP address
remove_ip() {
    local remove_ip="$1"
    validate_cidr "$remove_ip"
    
    check_aws_config
    check_stack_exists
    get_current_ips
    
    # Check if IP exists
    if ! echo "$CURRENT_IPS" | grep -q "$remove_ip"; then
        echo -e "${YELLOW}⚠️  IP address $remove_ip is not in the allowed list${NC}"
        return
    fi
    
    # Remove the IP
    NEW_IPS=$(echo "$CURRENT_IPS" | sed "s/$remove_ip,//g" | sed "s/,$remove_ip//g" | sed "s/^$remove_ip$//g")
    
    if [ -z "$NEW_IPS" ]; then
        echo -e "${RED}❌ Cannot remove the last IP address. At least one IP must be allowed.${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Removing IP address: $remove_ip${NC}"
    update_stack "$NEW_IPS"
    echo -e "${GREEN}✅ IP address $remove_ip removed successfully${NC}"
}

# Function to replace all IP addresses
replace_ips() {
    local new_ips="$1"
    
    # Validate each IP
    IFS=',' read -ra IP_ARRAY <<< "$new_ips"
    for ip in "${IP_ARRAY[@]}"; do
        ip=$(echo "$ip" | xargs)  # Trim whitespace
        validate_cidr "$ip"
    done
    
    check_aws_config
    check_stack_exists
    
    echo -e "${BLUE}Replacing all IP addresses with: $new_ips${NC}"
    update_stack "$new_ips"
    echo -e "${GREEN}✅ IP addresses replaced successfully${NC}"
}

# Main execution
case $COMMAND in
    current)
        show_current_ip
        ;;
    list)
        list_ips
        ;;
    add)
        if [ -z "$IP_VALUE" ]; then
            echo -e "${RED}❌ Error: IP address required for add command${NC}"
            usage
        fi
        add_ip "$IP_VALUE"
        ;;
    remove)
        if [ -z "$IP_VALUE" ]; then
            echo -e "${RED}❌ Error: IP address required for remove command${NC}"
            usage
        fi
        remove_ip "$IP_VALUE"
        ;;
    replace)
        if [ -z "$IP_VALUE" ]; then
            echo -e "${RED}❌ Error: IP addresses required for replace command${NC}"
            usage
        fi
        replace_ips "$IP_VALUE"
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        usage
        ;;
esac
