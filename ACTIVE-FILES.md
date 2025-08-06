# Active Files and Directory Structure

This document lists all the active files currently used by the Well-Architected Visualizer Tool solution.

## 📁 Core Deployment Files

### Main Deployment Scripts
- **`deploy-multi-region.sh`** - Primary deployment script with integrated Lambda build process
- **`cleanup-multi-region.sh`** - Resource cleanup script for removing AWS resources
- **`manage-ips.sh`** - IP address management utility for WAF configuration

### CloudFormation Templates
- **`wa-visualizer-regional.yaml`** - Regional resources (S3, Lambda, API Gateway)
- **`wa-visualizer-global.yaml`** - Global resources (CloudFront, WAF)

## 🌐 Web Application Files

- **`wa-api-visualizer.html`** - Main web application interface
- **`script-improved.js`** - JavaScript functionality including:
  - Chart rendering (Chart.js)
  - API communication
  - Excel export functionality (SheetJS)
  - PNG export capabilities
  - Risk and compliance calculations

## ⚡ Lambda Function Source

### `lambda-proxy/` Directory
- **`lambda_function_improved.py`** - Main Lambda function with enhanced compliance calculations
- **`requirements.txt`** - Python dependencies specification

### Python Dependencies (Required for Lambda Runtime)
- **`boto3/`** - AWS SDK for Python
- **`botocore/`** - Core AWS SDK functionality
- **`dateutil/`** - Date/time utilities
- **`jmespath/`** - JSON query language
- **`s3transfer/`** - S3 transfer utilities
- **`urllib3/`** - HTTP client library
- **`six.py`** - Python 2/3 compatibility library
- **Various `.dist-info/` directories** - Package metadata

## 📚 Documentation

- **`README.md`** - Comprehensive project documentation and usage guide
- **`SECURITY-UPDATES.md`** - Security information and update notes
- **`ACTIVE-FILES.md`** - This file documenting active file structure

## 🗑️ Files That Can Be Removed

### Temporary/Generated Files
- **`lambda-function.zip`** - Generated during deployment (recreated each time)
- **`.DS_Store`** - macOS system file
- **`temp_lambda/`** - Temporary directory from previous operations

### Legacy/Unused Files
- **`lambda_function.py`** (root directory) - Old Lambda function version
- **`README-operation.md`** - Outdated operational documentation
- **`REPOSITORY-STRUCTURE.md`** - Outdated repository structure documentation

### Unused Lambda-Proxy Files
- **`lambda-proxy/lambda_function.py`** - Old Lambda function version
- **`lambda-proxy/function.zip`** - Old zip file
- **`lambda-proxy/deploy.sh`** - Individual Lambda deploy script (not used)
- **`lambda-proxy/cloudformation.yaml`** - Individual CloudFormation template (not used)
- **`lambda-proxy/template.yaml`** - Old template file
- **`lambda-proxy/trust-policy.json`** - Individual policy file (policies now in main templates)
- **`lambda-proxy/wellarchitected-policy.json`** - Individual policy file (not used)
- **`lambda-proxy/test-credentials.py`** - Test file
- **`lambda-proxy/README.md`** - Lambda-specific readme (outdated)
- **`lambda-proxy/Dockerfile`** - Docker file (not used in current deployment)
- **`lambda-proxy/__pycache__/`** - Python cache directory

## 🏗️ Deployment Process

The active deployment process works as follows:

1. **`deploy-multi-region.sh`** reads the `lambda-proxy/` directory
2. Creates `lambda-function.zip` with timestamped S3 key
3. Uploads Lambda package to S3
4. Deploys CloudFormation templates
5. Uploads web application files to S3
6. Configures CloudFront and WAF

## 🔄 File Dependencies

```
deploy-multi-region.sh
├── wa-visualizer-regional.yaml
├── wa-visualizer-global.yaml
├── lambda-proxy/lambda_function_improved.py
├── lambda-proxy/requirements.txt
├── lambda-proxy/[Python dependencies]
├── wa-api-visualizer.html
└── script-improved.js

manage-ips.sh
└── (Uses AWS CLI to manage WAF IP sets)

cleanup-multi-region.sh
└── (Uses AWS CLI to delete CloudFormation stacks)
```

## 📊 File Size Summary

- **Total active files**: ~87MB (mostly Python dependencies)
- **Core application files**: ~50KB
- **Lambda dependencies**: ~87MB
- **Documentation**: ~50KB

## 🧹 Cleanup Recommendations

To maintain a clean repository:

1. Remove all files listed in the "Files That Can Be Removed" section
2. Keep the `.git/` directory for version control
3. Ensure `lambda-function.zip` is in `.gitignore` (it's regenerated)
4. Consider adding `__pycache__/` and `.DS_Store` to `.gitignore`

This structure provides a clean, maintainable codebase with clear separation of concerns and comprehensive documentation.
