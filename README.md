# Well-Architected Report Visualizer

A comprehensive web-based visualization tool for AWS Well-Architected Framework reports with Excel export capabilities. This solution provides an interactive dashboard to view workload assessment results with IP-based access control and professional reporting features.

## 🌟 Key Features

- 🔒 **IP-based Access Control** - Restrict access to specific IP addresses or ranges via AWS WAF
- 📊 **Interactive Dashboard** - User-friendly interface with charts and visual summaries
- 📈 **Risk Distribution Analysis** - Visual breakdown of risks across Well-Architected pillars
- 📋 **Accurate Compliance Metrics** - Properly calculated compliance percentages excluding out-of-scope items
- 🎯 **Risk Categorization** - Clear separation of high, medium, and compliant items
- 💡 **Actionable Recommendations** - Detailed guidance for high and medium risk items
- 📄 **Excel Export** - Professional Excel reports with recommendations and detailed guidance
- 🖼️ **PNG Export** - Export charts and summaries as images
- 🚀 **Automated Deployment** - Single-command deployment with integrated build process

## 🏗️ Solution Architecture

The solution consists of the following AWS components:

1. **CloudFront Distribution** - HTTPS-enabled CDN with WAF-based IP restrictions
2. **S3 Bucket** - Static website hosting for the web application
3. **WAF Web ACL** - IP-based access control layer
4. **Lambda Function** - Proxy for AWS Well-Architected API calls with enhanced data processing
5. **API Gateway** - RESTful API endpoint for the Lambda function
6. **IAM Role** - Minimal required permissions for Lambda to access Well-Architected API

### How It Works

1. User accesses the web application via CloudFront (IP-restricted)
2. Web application makes requests to API Gateway
3. API Gateway forwards requests to the Lambda function
4. Lambda function calls the AWS Well-Architected API and processes compliance data
5. Lambda function returns properly calculated results with CORS headers
6. Web application renders interactive dashboard with export capabilities

## 📋 Prerequisites

### Required Tools
- **AWS CLI** - Installed and configured with appropriate permissions
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

### Well-Architected Workloads
Create at least one workload in the AWS Well-Architected Tool console before using the visualizer.

## 🚀 Quick Start

### 1. Get Your IP Address
```bash
curl -s https://checkip.amazonaws.com
```

### 2. Deploy the Solution
```bash
./deploy-multi-region.sh --ip-addresses "YOUR_IP/32" --profile YOUR_AWS_PROFILE
```

**Example:**
```bash
./deploy-multi-region.sh --ip-addresses "203.0.113.45/32" --profile cevo-production
```

### 3. Access Your Application
Open the provided CloudFront URL in your browser (displayed at the end of deployment).

## 📖 Detailed Usage Guide

### Deployment Options

#### Single IP Address
```bash
./deploy-multi-region.sh --ip-addresses "203.0.113.45/32"
```

#### Multiple IP Addresses
```bash
./deploy-multi-region.sh --ip-addresses "203.0.113.45/32,198.51.100.10/32,192.0.2.100/32"
```

#### Office Network Range
```bash
./deploy-multi-region.sh --ip-addresses "203.0.113.0/24"
```

#### With Custom Project Name
```bash
./deploy-multi-region.sh --ip-addresses "203.0.113.45/32" --project-name "my-wa-tool" --environment "dev"
```

### Managing IP Addresses

After deployment, use the IP management script to modify allowed IP addresses:

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

## 🎯 Using the Web Application

### Loading Workloads

1. **List Available Workloads**
   - Click "List Available Workloads" to see all workloads in your account
   - Select a workload from the dropdown list

2. **Direct Workload Entry**
   - Enter a workload ARN or ID directly in the input field
   - Click "Fetch Workload Data"

### Understanding the Dashboard

#### Risk Summary Section
- **Visual Risk Distribution** - Pie chart showing high, medium, and compliant items
- **Compliance Percentage** - Overall compliance calculated excluding out-of-scope items
- **Risk Counts** - Numerical breakdown of risk categories
- **Export Options** - PNG export for charts and summaries

#### Pillar Analysis
- **Individual Pillar Cards** - Compliance percentage and risk breakdown per pillar
- **Spider Chart** - Visual representation of compliance across all pillars
- **Out-of-Scope Handling** - Pillars marked as out-of-scope show 0% (indicating no assessment)

#### Recommendations Section
- **High and Medium Risk Items** - Detailed list of items requiring attention
- **Improvement Guidance** - Actionable recommendations for each risk item
- **AWS Documentation Links** - Direct links to improvement plan resources
- **Excel Export** - Comprehensive Excel report with all recommendations

### Excel Export Features

The Excel export creates a professional multi-sheet workbook containing:

#### Sheet 1: Summary
- Workload information (name, ID, environment, owner)
- Risk summary statistics
- Overall compliance percentage
- Generation date and metadata

#### Sheet 2: Recommendations
- All high and medium risk items
- Question/area descriptions (formatted as actionable statements)
- Pillar assignments
- Risk levels
- AWS improvement plan URLs

#### Sheet 3: Pillar Breakdown
- Risk distribution by pillar
- Compliance percentages per pillar
- Detailed risk counts for analysis

**To Export:**
1. Load a workload and wait for recommendations to appear
2. Click "Export to Excel" in the Recommendations section
3. File downloads as `WA_Recommendations_[WorkloadName]_[Date].xlsx`

## 🔧 Advanced Configuration

### Custom Deployment Parameters

```bash
./deploy-multi-region.sh \
  --ip-addresses "203.0.113.0/24" \
  --project-name "custom-wa-tool" \
  --environment "production" \
  --profile "my-aws-profile"
```

### Environment Variables
The deployment script supports these parameters:
- `--ip-addresses` - Comma-separated list of IP addresses/ranges (required)
- `--project-name` - Custom project name (default: cevo-wa-visualiser-tool)
- `--environment` - Environment name (default: prod)
- `--profile` - AWS profile to use

### Regional Deployment
The solution deploys to:
- **Regional Resources** (ap-southeast-2): S3, Lambda, API Gateway
- **Global Resources** (us-east-1): CloudFront, WAF

## 🛠️ Technical Details

### Lambda Function Features
- **Enhanced Data Processing** - Correct compliance calculations excluding out-of-scope items
- **Comprehensive API Proxy** - Full access to Well-Architected API operations
- **CORS Support** - Proper cross-origin resource sharing headers
- **Error Handling** - Robust error handling and logging
- **IP Validation** - Server-side IP address validation
- **Dependency Management** - Includes boto3 1.26.0 and botocore 1.29.0

### Build Process
The deployment script automatically:
1. **Builds Lambda Package** - Creates zip file from lambda-proxy directory with all dependencies
2. **Uploads to S3** - Uses timestamped keys to force CloudFormation updates
3. **Updates CloudFormation** - Deploys both regional and global stacks
4. **Uploads Web Files** - Deploys HTML and JavaScript to S3
5. **Configures Access Control** - Sets up WAF rules and CloudFront distribution

### File Structure
```
├── README.md                           # This comprehensive guide
├── deploy-multi-region.sh              # Main deployment script with integrated build
├── manage-ips.sh                       # IP address management utility
├── wa-visualizer-regional.yaml         # CloudFormation template (regional resources)
├── wa-visualizer-global.yaml           # CloudFormation template (global resources)
├── wa-api-visualizer.html              # Web application HTML
├── script-improved.js                  # JavaScript with Excel export functionality
├── lambda-proxy/                       # Lambda function source directory
│   ├── lambda_function_improved.py     # Main Lambda function with enhanced processing
│   ├── requirements.txt                # Python dependencies
│   └── [boto3/botocore dependencies]   # AWS SDK libraries
├── cleanup-multi-region.sh             # Resource cleanup script
└── SECURITY-UPDATES.md                 # Security information and updates
```

## 🔍 Troubleshooting

### Common Issues

#### "Access Denied" Error
**Cause:** Your IP address may have changed or is not in the allowed list.
**Solution:**
```bash
# Check your current IP
curl -s https://checkip.amazonaws.com

# Add your new IP
./manage-ips.sh add YOUR_NEW_IP/32
```

#### "No Workloads Found"
**Cause:** No workloads exist in the AWS Well-Architected Tool.
**Solution:** Create a workload in the AWS Well-Architected Tool console first.

#### CloudFront Takes Time to Update
**Cause:** CloudFront distributions have propagation delays.
**Solution:** Changes may take 5-15 minutes to propagate globally.

#### Excel Export Not Working
**Cause:** JavaScript libraries not loaded or browser compatibility.
**Solution:** 
- Ensure you're using a modern browser
- Check browser console for JavaScript errors
- Try refreshing the page

#### Lambda Function Not Updating
**Cause:** CloudFormation not detecting S3 object changes.
**Solution:** The deployment script now uses timestamped S3 keys to force updates automatically.

### Debugging Steps

1. **Check CloudWatch Logs**
   ```bash
   aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/cevo-wa-visualiser-tool"
   ```

2. **Test API Directly**
   ```bash
   curl -X POST "YOUR_API_GATEWAY_URL/proxy" \
     -H "Content-Type: application/json" \
     -d '{"operation":"list_workloads","params":{}}'
   ```

3. **Verify IP Address**
   ```bash
   ./manage-ips.sh current
   ```

## 🧹 Cleanup

### Remove All Resources
```bash
# Delete CloudFormation stacks
aws cloudformation delete-stack --stack-name cevo-wa-visualiser-tool-regional --region ap-southeast-2
aws cloudformation delete-stack --stack-name cevo-wa-visualiser-tool-global --region us-east-1

# Or use the cleanup script
./cleanup-multi-region.sh
```

**Note:** S3 buckets must be emptied before deletion. The cleanup script handles this automatically.

## 📊 Compliance Calculation Details

### How Compliance is Calculated
The tool uses an enhanced compliance calculation that:

1. **Excludes Out-of-Scope Items** - Questions marked as "Not Applicable" don't affect compliance
2. **Counts Only Answered Questions** - Only HIGH, MEDIUM, and NONE risk items are included
3. **Handles Edge Cases** - Pillars with all out-of-scope questions show 0% (no assessment) rather than 100%

### Risk Categories
- **HIGH** - Critical issues requiring immediate attention
- **MEDIUM** - Important improvements recommended
- **NONE** - Compliant items following best practices
- **NOT_APPLICABLE** - Out-of-scope questions excluded from calculations
- **UNANSWERED** - Questions not yet answered (should be 0 for complete assessments)

## 🔐 Security Considerations

- **Latest Runtime** - Uses Python 3.12 for security patches
- **Updated Dependencies** - boto3 1.26.0 and botocore 1.29.0
- **IP Restriction** - Access limited to specified IP addresses via AWS WAF
- **HTTPS Only** - All traffic encrypted through CloudFront
- **No Direct S3 Access** - Website only accessible through CloudFront
- **IAM Role-based Access** - Lambda uses minimal required permissions
- **No Credentials in Browser** - All AWS API calls happen server-side

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- AWS Well-Architected Framework
- AWS CloudFormation, Lambda, API Gateway, CloudFront, and WAF
- SheetJS for Excel export functionality
- Chart.js for data visualization
- Bootstrap for responsive UI design

---

**Need Help?** Check the troubleshooting section above or review the CloudWatch logs for detailed error information.
