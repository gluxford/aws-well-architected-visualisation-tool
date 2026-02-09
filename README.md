# Well-Architected Report Visualizer

A comprehensive web-based visualization tool for AWS Well-Architected Framework reports with Excel export capabilities. This solution provides an interactive dashboard to view workload assessment results with secure Cognito-based authentication and professional reporting features.

## 🌟 Key Features

- 🔒 **Cognito Authentication** - Secure user authentication with email domain restriction (@cevo.com.au)
- 🛡️ **Multi-Factor Authentication (MFA)** - Required MFA for all users using authenticator apps
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

1. **CloudFront Distribution** - HTTPS-enabled CDN for global content delivery
2. **S3 Bucket** - Static website hosting for the web application
3. **Cognito User Pool** - User authentication with email domain restriction and MFA
4. **Lambda Function** - Proxy for AWS Well-Architected API calls with enhanced data processing
5. **API Gateway** - RESTful API endpoint for the Lambda function
6. **IAM Role** - Minimal required permissions for Lambda to access Well-Architected API

### How It Works

1. User accesses the web application via CloudFront
2. Cognito authentication overlay prompts for sign-in or registration
3. Only @cevo.com.au email addresses can register (domain-restricted)
4. Users must set up MFA using an authenticator app (Google Authenticator, Authy, etc.)
5. After authentication, web application makes requests to API Gateway
6. API Gateway forwards requests to the Lambda function
7. Lambda function calls the AWS Well-Architected API and processes compliance data
8. Lambda function returns properly calculated results with CORS headers
9. Web application renders interactive dashboard with export capabilities

## 📋 Prerequisites

### Required Tools
- **AWS CLI** - Installed and configured with appropriate permissions
- **curl** - For API testing
- **Authenticator App** - Google Authenticator, Authy, or similar for MFA setup

### Required AWS Permissions
Your AWS user/role needs permissions to create:
- CloudFormation stacks
- S3 buckets and objects
- CloudFront distributions
- Cognito User Pools
- Lambda functions
- API Gateway APIs
- IAM roles and policies

### Well-Architected Workloads
Create at least one workload in the AWS Well-Architected Tool console before using the visualizer.

### Email Requirements
Users must have a **@cevo.com.au** email address to register and access the application.

## 🚀 Quick Start

### 1. Deploy the Solution
```bash
./deploy-cognito.sh --profile YOUR_AWS_PROFILE
```

**Example:**
```bash
./deploy-cognito.sh --profile cevo-production
```

### 2. Access Your Application
Open the provided CloudFront URL in your browser (displayed at the end of deployment).

### 3. Register Your Account
1. Click "Sign up" on the authentication screen
2. Enter your @cevo.com.au email address
3. Create a strong password
4. Scan the QR code with your authenticator app
5. Enter the 6-digit code to complete MFA setup

### 4. Sign In
1. Enter your email and password
2. Enter the current 6-digit code from your authenticator app
3. Access the Well-Architected visualizer dashboard

## 📖 Detailed Usage Guide

### Deployment Options

#### Basic Deployment
```bash
./deploy-cognito.sh
```

#### With Custom Project Name
```bash
./deploy-cognito.sh --project-name "my-wa-tool" --environment "dev"
```

#### With Specific AWS Profile
```bash
./deploy-cognito.sh --profile "cevo-production" --environment "prod"
```

### User Management

#### First-Time User Registration
1. Navigate to the CloudFront URL
2. Click "Sign up" on the authentication screen
3. Enter your @cevo.com.au email address
4. Create a password (minimum 8 characters, must include uppercase, lowercase, numbers, and special characters)
5. Scan the displayed QR code with your authenticator app
6. Enter the 6-digit verification code
7. Complete registration and sign in

#### Subsequent Sign-Ins
1. Enter your email and password
2. Enter the current 6-digit MFA code from your authenticator app
3. Access the dashboard

#### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

#### Supported Authenticator Apps
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Any TOTP-compatible authenticator app

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
./deploy-cognito.sh \
  --project-name "custom-wa-tool" \
  --environment "production" \
  --profile "my-aws-profile"
```

### Environment Variables
The deployment script supports these parameters:
- `--project-name` - Custom project name (default: cevo-wa-visualiser-tool)
- `--environment` - Environment name (default: prod)
- `--profile` - AWS profile to use

### Regional Deployment
The solution deploys to:
- **Regional Resources** (ap-southeast-2): S3, Lambda, API Gateway, Cognito User Pool
- **Global Resources** (us-east-1): CloudFront

### Customizing Email Domain Restriction
To allow different email domains, modify the `wa-visualizer-regional.yaml` template:

1. Locate the `PreSignupLambda` function code
2. Update the email validation logic:
```python
if not email.endswith('@your-domain.com'):
    raise Exception('Only your-domain.com email addresses are allowed')
```
3. Redeploy the solution

## 🛠️ Technical Details

### Lambda Function Features
- **Enhanced Data Processing** - Correct compliance calculations excluding out-of-scope items
- **Comprehensive API Proxy** - Full access to Well-Architected API operations
- **CORS Support** - Proper cross-origin resource sharing headers
- **Error Handling** - Robust error handling and logging
- **Dependency Management** - Includes boto3 1.26.0 and botocore 1.29.0

### Cognito Authentication Features
- **Email Domain Restriction** - Only @cevo.com.au addresses can register
- **Automatic User Confirmation** - No email verification required for approved domains
- **Mandatory MFA** - Software token MFA required for all users
- **Session Management** - Secure session handling with automatic token refresh
- **Sign-Out Capability** - Users can sign out and clear their session

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
├── deploy-cognito.sh                   # Main deployment script with Cognito authentication
├── wa-visualizer-regional.yaml         # CloudFormation template (regional resources + Cognito)
├── wa-visualizer-global.yaml           # CloudFormation template (global resources)
├── wa-api-visualizer.html              # Web application HTML
├── script-improved.js                  # JavaScript with Excel export functionality
├── auth-overlay.js                     # Cognito authentication overlay with MFA
├── lambda-proxy/                       # Lambda function source directory
│   ├── lambda_function_improved.py     # Main Lambda function with enhanced processing
│   ├── requirements.txt                # Python dependencies
│   └── [boto3/botocore dependencies]   # AWS SDK libraries
├── cleanup-cognito.sh                  # Resource cleanup script
├── DEPLOYMENT-GUIDE.md                 # Detailed deployment instructions
└── SECURITY-UPDATES.md                 # Security information and updates
```

## 🔍 Troubleshooting

### Common Issues

#### "Only cevo.com.au email addresses are allowed"
**Cause:** Attempting to register with a non-approved email domain.
**Solution:** Use a valid @cevo.com.au email address or update the email domain restriction in the CloudFormation template.

#### "Invalid verification code" during MFA setup
**Cause:** Time synchronization issue or incorrect code entry.
**Solution:** 
- Ensure your device's time is synchronized
- Wait for a new code to generate
- Try entering the code immediately after it appears

#### "User does not exist" error
**Cause:** Account not yet created or incorrect email address.
**Solution:** Click "Sign up" to create a new account first.

#### "No Workloads Found"
**Cause:** No workloads exist in the AWS Well-Architected Tool.
**Solution:** Create a workload in the AWS Well-Architected Tool console first.

#### CloudFront Takes Time to Update
**Cause:** CloudFront distributions have propagation delays.
**Solution:** Changes may take 5-15 minutes to propagate globally.

#### MFA Code Not Working
**Cause:** Time drift between device and AWS servers.
**Solution:**
- Ensure your device's clock is accurate
- Rescan the QR code if needed
- Contact administrator to reset MFA if locked out

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

3. **Check Cognito User Pool**
   ```bash
   aws cognito-idp list-user-pools --max-results 10 --region ap-southeast-2
   ```

4. **View User Pool Users**
   ```bash
   aws cognito-idp list-users --user-pool-id YOUR_USER_POOL_ID --region ap-southeast-2
   ```

## 🧹 Cleanup

### Remove All Resources
```bash
# Use the cleanup script
./cleanup-cognito.sh
```

**Or manually delete stacks:**
```bash
# Delete CloudFormation stacks
aws cloudformation delete-stack --stack-name cevo-wa-visualiser-tool-regional --region ap-southeast-2
aws cloudformation delete-stack --stack-name cevo-wa-visualiser-tool-global --region us-east-1
```

**Note:** S3 buckets and Cognito User Pools must be emptied before deletion. The cleanup script handles this automatically.

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
- **Cognito Authentication** - Industry-standard user authentication and authorization
- **Email Domain Restriction** - Only approved email domains can register (@cevo.com.au)
- **Mandatory MFA** - All users required to set up multi-factor authentication
- **HTTPS Only** - All traffic encrypted through CloudFront
- **No Direct S3 Access** - Website only accessible through CloudFront
- **IAM Role-based Access** - Lambda uses minimal required permissions
- **No Credentials in Browser** - All AWS API calls happen server-side
- **Session Management** - Secure token-based session handling
- **Auto-confirmation** - Approved domain users are automatically confirmed (no email verification needed)

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
