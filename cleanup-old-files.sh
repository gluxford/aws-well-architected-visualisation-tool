#!/bin/bash

# Cleanup script for removing outdated files from the Well-Architected Visualizer
# This script helps clean up repositories that may have old deployment files

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Well-Architected Visualizer Cleanup Script${NC}"
echo "This script will remove outdated files from your repository"
echo ""

# List of files that should be removed if they exist
OLD_FILES=(
    "deploy.sh"
    "deploy-portable.sh" 
    "deploy-fixed.sh"
    "wa-visualizer-complete.yaml"
    "wa-visualizer-template.yaml"
    "README-deployment.md"
    "README-deployment-updated.md"
    "wa-visualizer-infra.yaml"
    "wa-visualizer-lambda.yaml"
    "wa-visualizer-content.yaml"
    "wa-visualizer-master.yaml"
    "script.js"
    "styles.css"
)

# Check which files exist
FILES_TO_REMOVE=()
for file in "${OLD_FILES[@]}"; do
    if [ -f "$file" ]; then
        FILES_TO_REMOVE+=("$file")
    fi
done

if [ ${#FILES_TO_REMOVE[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ No outdated files found. Your repository is clean!${NC}"
    exit 0
fi

echo -e "${YELLOW}📋 Found the following outdated files:${NC}"
for file in "${FILES_TO_REMOVE[@]}"; do
    echo "  • $file"
done
echo ""

# Ask for confirmation
read -p "Do you want to remove these files? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏭️  Cleanup cancelled${NC}"
    exit 0
fi

# Remove the files
echo -e "${BLUE}Removing outdated files...${NC}"
for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}✅ Removed: $file${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 Cleanup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Current deployment files:${NC}"
echo "  • deploy-multi-ip.sh (standard deployment)"
echo "  • deploy-container.sh (container deployment)"
echo "  • manage-ips.sh (IP address management)"
echo "  • wa-visualizer-multi-ip.yaml (standard template)"
echo "  • wa-visualizer-container.yaml (container template)"
echo ""
echo -e "${BLUE}🚀 To deploy the solution:${NC}"
echo "  Standard: ./deploy-multi-ip.sh --ip-addresses \"YOUR_IP/32\""
echo "  Container: ./deploy-container.sh --ip-addresses \"YOUR_IP/32\""
