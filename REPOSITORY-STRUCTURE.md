# Repository Structure - Well-Architected Visualizer

This document describes the current, clean structure of the Well-Architected Visualizer repository after cleanup.

## Current Files (Clean Repository)

### 📋 Documentation
- `README.md` - Main project documentation with deployment instructions
- `README-operation.md` - Detailed operation guide
- `REPOSITORY-STRUCTURE.md` - This file
- `SECURITY-UPDATES.md` - Security updates and vulnerability mitigation

### 🚀 Deployment Scripts
- `deploy-multi-ip.sh` - **Standard deployment** (recommended for most users)
- `deploy-container.sh` - **Container deployment** (better performance)
- `manage-ips.sh` - **IP address management** (works with both deployment types)
- `cleanup-old-files.sh` - **Repository cleanup** (removes outdated files)

### 📄 CloudFormation Templates
- `wa-visualizer-multi-ip.yaml` - Standard deployment template
- `wa-visualizer-container.yaml` - Container deployment template

### 🌐 Web Application
- `wa-api-visualizer.html` - Main web application HTML
- `script-improved.js` - Enhanced JavaScript with full functionality

### 🐳 Container Support
- `lambda-proxy/` - Directory for container-based Lambda deployment
  - `Dockerfile` - Container build configuration
  - `lambda_function_improved.py` - Enhanced Lambda function with IP validation
  - `requirements.txt` - Python dependencies
  - `README.md` - Lambda-specific documentation

## Deployment Options

### Option 1: Standard Deployment
```bash
./deploy-multi-ip.sh --ip-addresses "YOUR_IP/32"
```
- ✅ Simple and fast deployment
- ✅ No Docker required
- ✅ Inline Lambda function in CloudFormation
- ⚠️ Standard cold start performance

### Option 2: Container Deployment
```bash
./deploy-container.sh --ip-addresses "YOUR_IP/32"
```
- ✅ Faster cold start performance
- ✅ Enhanced Lambda functionality
- ✅ Better dependency management
- ⚠️ Requires Docker
- ⚠️ Slower initial deployment (Docker build)

## IP Address Management

Both deployment types support the same IP management commands:

```bash
./manage-ips.sh current                    # Show your current IP
./manage-ips.sh list                       # List allowed IPs
./manage-ips.sh add 203.0.113.45/32       # Add an IP
./manage-ips.sh remove 203.0.113.45/32    # Remove an IP
./manage-ips.sh replace "IP1/32,IP2/32"   # Replace all IPs
```

## Removed Files (Outdated)

The following files have been removed to prevent confusion:

### ❌ Old Deployment Scripts
- `deploy.sh` - Original deployment script
- `deploy-portable.sh` - Intermediate script
- `deploy-fixed.sh` - Superseded by multi-IP version

### ❌ Old CloudFormation Templates
- `wa-visualizer-complete.yaml` - Superseded by multi-IP version
- `wa-visualizer-template.yaml` - Referenced by old scripts
- `wa-visualizer-infra.yaml` - Old nested template approach
- `wa-visualizer-lambda.yaml` - Old nested template approach
- `wa-visualizer-content.yaml` - Old nested template approach
- `wa-visualizer-master.yaml` - Old nested template approach

### ❌ Old Documentation
- `README-deployment.md` - Outdated deployment guide
- `README-deployment-updated.md` - Intermediate documentation
- `SOLUTION-SUMMARY.md` - Specific troubleshooting session notes

## Migration from Old Files

If you have an existing repository with old files, run:

```bash
./cleanup-old-files.sh
```

This will safely remove outdated files while preserving your current deployment.

## Stack Names

The deployment scripts create CloudFormation stacks with these names:

- **Standard deployment**: `wa-visualizer-multi-ip`
- **Container deployment**: `wa-visualizer-container`

The `manage-ips.sh` script automatically detects which type you've deployed.

## Security Features

Both deployment options include:

- 🔒 **IP-based access control** via AWS WAF
- 🔐 **HTTPS-only access** via CloudFront
- 🛡️ **No direct S3 access** (CloudFront only)
- 🔑 **IAM role-based Lambda permissions**
- 🚫 **No credentials in browser**

## Quick Start

1. **Get your IP**: `curl -s https://checkip.amazonaws.com`
2. **Choose deployment**:
   - Simple: `./deploy-multi-ip.sh --ip-addresses "YOUR_IP/32"`
   - Performance: `./deploy-container.sh --ip-addresses "YOUR_IP/32"`
3. **Access the provided CloudFront URL**

## Support

- Check CloudWatch logs for Lambda errors
- Use `./manage-ips.sh current` to verify your IP
- Test API directly with curl commands shown in deployment output
