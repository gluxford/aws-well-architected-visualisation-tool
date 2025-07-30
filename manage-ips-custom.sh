#!/bin/bash

# IP Address Management Script for Well-Architected Visualizer (Custom Stack Names)
# This script helps you add, remove, or list IP addresses after deployment

set -e

# Configuration - Updated for custom stack names
GLOBAL_STACK_NAME="cevo-wa-visualiser-tool-global"
REGIONAL_STACK_NAME="cevo-wa-visualiser-tool-regional"
GLOBAL_REGION="us-east-1"
REGIONAL_REGION="ap-southeast-2"

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

# Function to get WAF IP set details
get_waf_ipset_details() {
    echo -e "${BLUE}Getting WAF IP set details...${NC}"
    
    # Get IP set details from the global stack
    IPSET_INFO=$(aws cloudformation describe-stack-resources \
        --stack-name $GLOBAL_STACK_NAME \
        --region $GLOBAL_REGION \
        --query "StackResources[?ResourceType=='AWS::WAFv2::IPSet'].PhysicalResourceId" \
        --output text)
    
    if [ -z "$IPSET_INFO" ]; then
        echo -e "${RED}❌ Could not find WAF IP set in stack $GLOBAL_STACK_NAME${NC}"
        exit 1
    fi
    
    # Parse the IP set info (format: name|id|scope)
    IFS='|' read -r IPSET_NAME IPSET_ID IPSET_SCOPE <<< "$IPSET_INFO"
    
    echo "Found IP set: $IPSET_NAME (ID: $IPSET_ID, Scope: $IPSET_SCOPE)"
}

# Function to get current IP addresses from WAF IP set
get_current_ips_from_waf() {
    IPSET_DATA=$(aws wafv2 get-ip-set \
        --name "$IPSET_NAME" \
        --id "$IPSET_ID" \
        --scope "$IPSET_SCOPE" \
        --region $GLOBAL_REGION)
    
    CURRENT_IPS=$(echo "$IPSET_DATA" | jq -r '.IPSet.Addresses[]' | tr '\n' ',' | sed 's/,$//')
    LOCK_TOKEN=$(echo "$IPSET_DATA" | jq -r '.LockToken')
    
    if [ -z "$CURRENT_IPS" ]; then
        CURRENT_IPS=""
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

# Function to update WAF IP set
update_waf_ipset() {
    local new_ips="$1"
    echo -e "${BLUE}Updating WAF IP set...${NC}"
    
    # Convert comma-separated string to JSON array
    if [ -z "$new_ips" ]; then
        IP_ARRAY="[]"
    else
        IFS=',' read -ra IPS <<< "$new_ips"
        IP_ARRAY=$(printf '%s\n' "${IPS[@]}" | jq -R . | jq -s .)
    fi
    
    aws wafv2 update-ip-set \
        --name "$IPSET_NAME" \
        --id "$IPSET_ID" \
        --scope "$IPSET_SCOPE" \
        --lock-token "$LOCK_TOKEN" \
        --addresses "$IP_ARRAY" \
        --region $GLOBAL_REGION > /dev/null
    
    echo -e "${GREEN}✅ WAF IP set updated successfully${NC}"
    echo -e "${YELLOW}⏳ Changes may take 5-15 minutes to propagate through CloudFront${NC}"
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
    get_waf_ipset_details
    get_current_ips_from_waf
    
    echo -e "${BLUE}Current allowed IP addresses:${NC}"
    if [ -z "$CURRENT_IPS" ]; then
        echo "  (none)"
    else
        IFS=',' read -ra IP_ARRAY <<< "$CURRENT_IPS"
        for ip in "${IP_ARRAY[@]}"; do
            ip=$(echo "$ip" | xargs)  # Trim whitespace
            echo "  • $ip"
        done
    fi
}

# Function to add an IP address
add_ip() {
    local new_ip="$1"
    validate_cidr "$new_ip"
    
    check_aws_config
    get_waf_ipset_details
    get_current_ips_from_waf
    
    # Check if IP already exists
    if echo "$CURRENT_IPS" | grep -q "$new_ip"; then
        echo -e "${YELLOW}⚠️  IP address $new_ip is already in the allowed list${NC}"
        return
    fi
    
    # Add the new IP
    if [ -z "$CURRENT_IPS" ]; then
        NEW_IPS="$new_ip"
    else
        NEW_IPS="$CURRENT_IPS,$new_ip"
    fi
    
    echo -e "${BLUE}Adding IP address: $new_ip${NC}"
    update_waf_ipset "$NEW_IPS"
    echo -e "${GREEN}✅ IP address $new_ip added successfully${NC}"
}

# Function to remove an IP address
remove_ip() {
    local remove_ip="$1"
    validate_cidr "$remove_ip"
    
    check_aws_config
    get_waf_ipset_details
    get_current_ips_from_waf
    
    # Check if IP exists
    if ! echo "$CURRENT_IPS" | grep -q "$remove_ip"; then
        echo -e "${YELLOW}⚠️  IP address $remove_ip is not in the allowed list${NC}"
        return
    fi
    
    # Remove the IP
    NEW_IPS=$(echo "$CURRENT_IPS" | sed "s/$remove_ip,//g" | sed "s/,$remove_ip//g" | sed "s/^$remove_ip$//g")
    
    # Clean up any double commas
    NEW_IPS=$(echo "$NEW_IPS" | sed 's/,,/,/g' | sed 's/^,//' | sed 's/,$//')
    
    echo -e "${BLUE}Removing IP address: $remove_ip${NC}"
    update_waf_ipset "$NEW_IPS"
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
    get_waf_ipset_details
    get_current_ips_from_waf
    
    echo -e "${BLUE}Replacing all IP addresses with: $new_ips${NC}"
    update_waf_ipset "$new_ips"
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
