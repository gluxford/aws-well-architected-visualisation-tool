#!/bin/bash

# Repository cleanup script for Well-Architected Visualizer Tool
# This script removes temporary, generated, and unused files to keep the repository clean

set -e

echo "🧹 Cleaning up Well-Architected Visualizer Tool repository..."

# Remove temporary and generated files
echo "Removing temporary and generated files..."
[ -f lambda-function.zip ] && rm -f lambda-function.zip && echo "  ✓ Removed lambda-function.zip"
[ -f .DS_Store ] && rm -f .DS_Store && echo "  ✓ Removed .DS_Store"
[ -d temp_lambda ] && rm -rf temp_lambda/ && echo "  ✓ Removed temp_lambda/"

# Remove legacy/unused files from root directory
echo "Removing legacy files from root directory..."
[ -f lambda_function.py ] && rm -f lambda_function.py && echo "  ✓ Removed lambda_function.py"
[ -f README-operation.md ] && rm -f README-operation.md && echo "  ✓ Removed README-operation.md"
[ -f REPOSITORY-STRUCTURE.md ] && rm -f REPOSITORY-STRUCTURE.md && echo "  ✓ Removed REPOSITORY-STRUCTURE.md"

# Clean up lambda-proxy directory
echo "Cleaning up lambda-proxy directory..."
cd lambda-proxy

# Remove unused Lambda function files
[ -f lambda_function.py ] && rm -f lambda_function.py && echo "  ✓ Removed lambda-proxy/lambda_function.py"
[ -f function.zip ] && rm -f function.zip && echo "  ✓ Removed lambda-proxy/function.zip"
[ -f deploy.sh ] && rm -f deploy.sh && echo "  ✓ Removed lambda-proxy/deploy.sh"

# Remove unused CloudFormation templates
[ -f cloudformation.yaml ] && rm -f cloudformation.yaml && echo "  ✓ Removed lambda-proxy/cloudformation.yaml"
[ -f template.yaml ] && rm -f template.yaml && echo "  ✓ Removed lambda-proxy/template.yaml"

# Remove unused policy files
[ -f trust-policy.json ] && rm -f trust-policy.json && echo "  ✓ Removed lambda-proxy/trust-policy.json"
[ -f wellarchitected-policy.json ] && rm -f wellarchitected-policy.json && echo "  ✓ Removed lambda-proxy/wellarchitected-policy.json"

# Remove test and documentation files
[ -f test-credentials.py ] && rm -f test-credentials.py && echo "  ✓ Removed lambda-proxy/test-credentials.py"
[ -f README.md ] && rm -f README.md && echo "  ✓ Removed lambda-proxy/README.md"

# Remove Docker files (not used in current deployment)
[ -f Dockerfile ] && rm -f Dockerfile && echo "  ✓ Removed lambda-proxy/Dockerfile"

# Remove Python cache directories
[ -d __pycache__ ] && rm -rf __pycache__/ && echo "  ✓ Removed lambda-proxy/__pycache__/"

cd ..

echo ""
echo "✅ Repository cleanup completed!"
echo ""
echo "📁 Active files structure:"
echo "   Core Deployment:"
echo "   ├── deploy-multi-region.sh"
echo "   ├── wa-visualizer-regional.yaml"
echo "   ├── wa-visualizer-global.yaml"
echo "   ├── cleanup-multi-region.sh"
echo "   └── manage-ips.sh"
echo ""
echo "   Web Application:"
echo "   ├── wa-api-visualizer.html"
echo "   └── script-improved.js"
echo ""
echo "   Lambda Function:"
echo "   └── lambda-proxy/"
echo "       ├── lambda_function_improved.py"
echo "       ├── requirements.txt"
echo "       └── [Python dependencies]"
echo ""
echo "   Documentation:"
echo "   ├── README.md"
echo "   ├── SECURITY-UPDATES.md"
echo "   ├── ACTIVE-FILES.md"
echo "   └── cleanup-repository.sh"
echo ""
echo "🎯 Repository is now clean and organized!"
echo ""
echo "💡 Next steps:"
echo "   1. Review the updated README.md for comprehensive usage instructions"
echo "   2. Check ACTIVE-FILES.md for detailed file structure documentation"
echo "   3. Consider adding the following to .gitignore:"
echo "      - lambda-function.zip"
echo "      - .DS_Store"
echo "      - __pycache__/"
echo "      - temp_lambda/"
