# Well-Architected Report Visualizer

A web-based visualization tool for AWS Well-Architected Framework reports. This solution allows users to view their workload assessment results in a user-friendly dashboard with IP-based access control.

## Overview

The Well-Architected Report Visualizer provides a simple way to visualize and share the results of AWS Well-Architected Tool assessments. It solves the CORS (Cross-Origin Resource Sharing) issues that prevent direct browser access to the AWS Well-Architected API.

### Key Features

- 🔒 **IP-based Access Control** - Restrict access to specific IP addresses or ranges
- 📊 **Interactive Dashboard** - View workload assessment results in a user-friendly interface
- 📈 **Risk Distribution** - Display risk distribution across Well-Architected pillars
- 📋 **Compliance Metrics** - Show compliance percentages for each pillar
- 🎯 **Risk Categorization** - List high, medium, and low risk items
- 💡 **Recommendations** - Provide actionable recommendations based on assessment results
- 🚀 **Multiple Deployment Options** - Choose between standard or container-based Lambda deployment

## Solution Architecture

The solution consists of the following components:

1. **CloudFront Distribution** - HTTPS-enabled CDN with WAF-based IP restrictions
2. **S3 Bucket** - Static website hosting for the web application
3. **WAF Web ACL** - IP-based access control layer
4. **Lambda Function** - Proxy for AWS Well-Architected API calls (standard or container-based)
5. **API Gateway** - RESTful API endpoint for the Lambda function
6. **IAM Role** - Minimal required permissions for Lambda to access Well-Architected API

### How It Works

1. User accesses the web application via CloudFront (IP-restricted)
2. Web application makes requests to API Gateway
3. API Gateway forwards requests to the Lambda function
4. Lambda function calls the AWS Well-Architected API using its IAM role
5. Lambda function returns results to the web application with proper CORS headers
6. Web application renders the data in an interactive dashboard

## Deployment Options

Choose the deployment method that best fits your needs:

### Option 1: Standard Deployment (Recommended for most users)

Uses inline Lambda function in CloudFormation for simple deployment:

```bash
# Single IP address
./deploy-multi-ip.sh --ip-addresses "203.0.113.45/32"

# Multiple IP addresses
./deploy-multi-ip.sh --ip-addresses "203.0.113.45/32,198.51.100.10/32,192.0.2.100/32"

# Office network range
./deploy-multi-ip.sh --ip-addresses "203.0.113.0/24"
```

### Option 2: Container-based Deployment (Better performance)

Uses Docker container for Lambda with faster cold starts and enhanced functionality:

```bash
# Deploy with container build
./deploy-container.sh --ip-addresses "203.0.113.45/32"

# Deploy with existing container image
./deploy-container.sh --ip-addresses "203.0.113.45/32" --skip-build
```

**Container Benefits:**
- ⚡ Faster cold start performance
- 🔧 Enhanced Lambda functionality (IP validation, better error handling)
- 📦 Better dependency management
- 📏 Larger deployment package size limits

## Prerequisites

### Required Tools
- **AWS CLI** - Installed and configured with appropriate permissions
- **Docker** - Required for container-based deployment only
- **curl** - For IP address detection and API testing

### Required AWS Permissions
Your AWS user/role needs permissions to create:
- CloudFormation stacks
- S3 buckets and objects
- CloudFront distributions
- WAF Web ACLs and IP sets
- Lambda functions
- API Gateway APIs
- IAM roles and policies
- ECR repositories (container deployment only)

### Well-Architected Workloads
Create at least one workload in the AWS Well-Architected Tool console before using the visualizer.

## Quick Start

1. **Get your IP address:**
   ```bash
   curl -s https://checkip.amazonaws.com
   ```

2. **Choose your deployment method:**
   
   **Standard deployment:**
   ```bash
   ./deploy-multi-ip.sh --ip-addresses "YOUR_IP/32"
   ```
   
   **Container deployment:**
   ```bash
   ./deploy-container.sh --ip-addresses "YOUR_IP/32"
   ```

3. **Access your application:**
   Open the provided CloudFront URL in your browser

## Managing IP Addresses

After deployment, use the IP management script to add, remove, or update allowed IP addresses:

```bash
# Show your current IP
./manage-ips.sh current

# List currently allowed IPs
./manage-ips.sh list

# Add a new IP address
./manage-ips.sh add 203.0.113.45/32

# Remove an IP address
./manage-ips.sh remove 203.0.113.45/32

# Replace all IPs at once
./manage-ips.sh replace "203.0.113.45/32,198.51.100.10/32"
```

## Usage

### Basic Usage

1. Open the web application in your browser using the CloudFront URL
2. Click "List Available Workloads" to see your Well-Architected workloads
3. Select a workload to generate and view its assessment report

### Understanding the Dashboard

- **Risk Distribution Charts** - Visual representation of risks across pillars
- **Compliance Percentages** - Shows how well each pillar is implemented
- **Risk Items** - Detailed breakdown of high, medium, and low risk items
- **Recommendations** - Actionable guidance based on your assessment

## File Structure

```
├── README.md                           # This file
├── deploy-multi-ip.sh                  # Standard deployment script
├── deploy-container.sh                 # Container-based deployment script
├── manage-ips.sh                       # IP address management script
├── wa-visualizer-multi-ip.yaml         # Standard CloudFormation template
├── wa-visualizer-container.yaml        # Container-based CloudFormation template
├── wa-api-visualizer.html              # Web application HTML
├── script-improved.js                  # Web application JavaScript
├── lambda-proxy/                       # Container-based Lambda source
│   ├── Dockerfile                      # Docker configuration
│   ├── lambda_function_improved.py     # Enhanced Lambda function
│   ├── requirements.txt                # Python dependencies
│   └── README.md                       # Lambda-specific documentation
└── README-operation.md                 # Detailed operation guide
```

## Deployment Comparison

| Feature | Standard Deployment | Container Deployment |
|---------|-------------------|---------------------|
| **Deployment Speed** | Fast | Slower (Docker build) |
| **Cold Start Performance** | Standard | Faster |
| **Lambda Functionality** | Basic | Enhanced |
| **Dependency Management** | Limited | Full control |
| **Package Size Limit** | 50MB | 10GB |
| **Prerequisites** | AWS CLI only | AWS CLI + Docker |
| **Complexity** | Simple | Moderate |

## Security Considerations

- **Latest Runtime**: Uses Python 3.13 (latest stable) for security patches
- **Updated Dependencies**: boto3 1.39.15 and botocore 1.39.15 (latest versions)
- **IP Restriction**: Access is limited to specified IP addresses via AWS WAF
- **HTTPS Only**: All traffic is encrypted through CloudFront
- **No Direct S3 Access**: Website is only accessible through CloudFront
- **IAM Role-based Access**: Lambda uses minimal required permissions
- **No Credentials in Browser**: All AWS API calls happen server-side
- **Container Security**: Container images are scanned for vulnerabilities (container deployment)
- **Type Safety**: Modern Python type hints reduce runtime errors

For detailed security information, see [SECURITY-UPDATES.md](SECURITY-UPDATES.md).

## Troubleshooting

### Common Issues

1. **"Access Denied" Error**
   - Your IP address may have changed
   - Update with: `./manage-ips.sh add YOUR_NEW_IP/32`

2. **"No Workloads Found"**
   - Create a workload in the AWS Well-Architected Tool console first

3. **CloudFront Takes Time to Update**
   - Changes may take 5-15 minutes to propagate

4. **Docker Build Fails** (Container deployment)
   - Ensure Docker is installed and running
   - Check Docker daemon status

### Getting Help

- Check CloudWatch logs for Lambda function errors
- Use `./manage-ips.sh current` to verify your IP address
- Test API directly: `curl -X GET "YOUR_API_GATEWAY_URL/workloads"`

## Cleanup

To delete all resources:

```bash
# For standard deployment
aws cloudformation delete-stack --stack-name wa-visualizer-multi-ip

# For container deployment
aws cloudformation delete-stack --stack-name wa-visualizer-container
```

**Note**: S3 buckets must be emptied before deletion. The CloudFormation stack deletion will handle this automatically.

## Customization

The solution can be customized by:

- **Modifying CloudFormation templates** for infrastructure changes
- **Updating web application files** for UI/UX improvements
- **Enhancing Lambda functions** for additional functionality
- **Adding custom domains** to CloudFront
- **Implementing additional authentication** in API Gateway

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- AWS Well-Architected Framework
- AWS CloudFormation, Lambda, API Gateway, CloudFront, and WAF
- Docker for containerization support
