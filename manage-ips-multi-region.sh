#!/bin/bash

# IP management script for multi-region Well-Architected Visualizer
# Manages IP addresses in the WAF IP Set deployed in us-east-1

set -e

# Default values
PROJECT_NAME="cevo-wa-visualiser-tool"
GLOBAL_REGION="us-east-1"
AWS_PROFILE=""

# Function to display usage
usage() {
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  current                    Show your current public IP address"
    echo "  list                       List currently allowed IP addresses"
    echo "  add IP_ADDRESS             Add an IP address (CIDR format)"
    echo "  remove IP_ADDRESS          Remove an IP address"
    echo "  replace IP_LIST            Replace all IPs with new comma-separated list"
    echo ""
    echo "Options:"
    echo "  --project-name NAME        Project name prefix (default: cevo-wa-visualiser-tool)"
    echo "  --profile PROFILE          AWS profile to use"
    echo ""
    echo "Examples:"
    echo "  $0 current"
    echo "  $0 list --profile cevo-production"
    echo "  $0 add 203.0.113.45/32"
    echo "  $0 remove 203.0.113.45/32"
    echo "  $0 replace \"203.0.113.45/32,198.51.100.10/32\""
    exit 1
}

# Function to get current public IP
get_current_ip() {
    curl -s https://checkip.amazonaws.com
}

# Function to get IP Set ID
get_ipset_id() {
    aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-global" \
        --region "$GLOBAL_REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`IPSetId`].OutputValue' \
        --output text 2>/dev/null || {
        echo "Error: Could not find global stack '${PROJECT_NAME}-global' in region $GLOBAL_REGION"
        echo "Make sure the stack is deployed and you have the correct project name."
        exit 1
    }
}

# Function to get current IP addresses from IP Set
get_current_ips() {
    local ipset_id=$(get_ipset_id)
    aws wafv2 get-ip-set \
        --scope CLOUDFRONT \
        --id "$ipset_id" \
        --region "$GLOBAL_REGION" \
        --query 'IPSet.Addresses' \
        --output text | tr '\t' '\n'
}

# Function to update IP Set
update_ipset() {
    local new_addresses="$1"
    local ipset_id=$(get_ipset_id)
    
    # Get current lock token
    local lock_token=$(aws wafv2 get-ip-set \
        --scope CLOUDFRONT \
        --id "$ipset_id" \
        --region "$GLOBAL_REGION" \
        --query 'LockToken' \
        --output text)
    
    # Convert comma-separated list to array format for AWS CLI
    local addresses_array=""
    if [[ -n "$new_addresses" ]]; then
        IFS=',' read -ra ADDR <<< "$new_addresses"
        for addr in "${ADDR[@]}"; do
            addresses_array="$addresses_array \"$(echo $addr | xargs)\""
        done
        addresses_array="[${addresses_array// /,}]"
    else
        addresses_array="[]"
    fi
    
    # Update the IP Set
    aws wafv2 update-ip-set \
        --scope CLOUDFRONT \
        --id "$ipset_id" \
        --region "$GLOBAL_REGION" \
        --addresses "$addresses_array" \
        --lock-token "$lock_token" > /dev/null
    
    echo "IP Set updated successfully!"
}

# Parse command line arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        current|list|add|remove|replace)
            if [[ -n "$COMMAND" ]]; then
                echo "Error: Multiple commands specified"
                usage
            fi
            COMMAND="$1"
            if [[ "$COMMAND" == "add" || "$COMMAND" == "remove" || "$COMMAND" == "replace" ]]; then
                if [[ $# -lt 2 ]]; then
                    echo "Error: $COMMAND requires an argument"
                    usage
                fi
                COMMAND_ARG="$2"
                shift 2
            else
                shift
            fi
            ;;
        --project-name)
            PROJECT_NAME="$2"
            shift 2
            ;;
        --profile)
            AWS_PROFILE="$2"
            shift 2
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

# Validate command
if [[ -z "$COMMAND" ]]; then
    echo "Error: No command specified"
    usage
fi

# Set AWS profile if provided
if [[ -n "$AWS_PROFILE" ]]; then
    export AWS_PROFILE="$AWS_PROFILE"
fi

# Execute command
case $COMMAND in
    current)
        echo "Your current public IP address is: $(get_current_ip)"
        ;;
    list)
        echo "Currently allowed IP addresses:"
        get_current_ips | while read -r ip; do
            if [[ -n "$ip" ]]; then
                echo "  $ip"
            fi
        done
        ;;
    add)
        echo "Adding IP address: $COMMAND_ARG"
        current_ips=$(get_current_ips | tr '\n' ',' | sed 's/,$//')
        if [[ -n "$current_ips" ]]; then
            new_ips="${current_ips},${COMMAND_ARG}"
        else
            new_ips="$COMMAND_ARG"
        fi
        update_ipset "$new_ips"
        ;;
    remove)
        echo "Removing IP address: $COMMAND_ARG"
        current_ips=$(get_current_ips | grep -v "^${COMMAND_ARG}$" | tr '\n' ',' | sed 's/,$//')
        update_ipset "$current_ips"
        ;;
    replace)
        echo "Replacing all IP addresses with: $COMMAND_ARG"
        update_ipset "$COMMAND_ARG"
        ;;
esac

echo ""
echo "Note: Changes may take a few minutes to propagate through CloudFront."
