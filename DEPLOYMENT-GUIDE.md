# Well-Architected Visualizer - Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the Well-Architected Visualizer in any AWS environment with proper security controls.

## Prerequisites

### Required Tools
- **AWS CLI** - Version 2.x installed and configured
- **curl** - For testing API endpoints
- **zip** - For packaging Lambda functions

### Required AWS Permissions
Your AWS user/role needs permissions to create:
- CloudFormation stacks
- S3 buckets and objects
- CloudFront distributions
- Lambda functions
- API Gateway APIs
- IAM roles and policies
- Cognito User Pools

### Well-Architected Workloads
Ensure you have at least one workload in the AWS Well-Architected Tool console before deployment.

## Deployment Process

### Step 1: Prepare Environment

1. **Clone/Download the solution files**
2. **Set your AWS profile** (replace `your-profile-name`):
   ```bash
   export AWS_PROFILE=your-profile-name
   ```

3. **Verify AWS access**:
   ```bash
   aws sts get-caller-identity
   ```

### Step 2: Configure Email Domain (IMPORTANT)

**For Cevo deployments:** Skip this step (uses cevo.com.au by default)

**For customer deployments:** Update the email domain validation:

1. **Edit the regional template**:
   ```bash
   nano wa-visualizer-regional-secure.yaml
   ```

2. **Find the PreSignupLambda code section** (around line 85) and replace:
   ```python
   # Change this line:
   if not email.endswith('@cevo.com.au'):
       raise Exception('Only cevo.com.au email addresses are allowed')
   
   # To your customer's domain:
   if not email.endswith('@customer-domain.com'):
       raise Exception('Only customer-domain.com email addresses are allowed')
   ```

3. **Save the file**

### Step 3: Deploy Infrastructure

**Use the secure deployment script:**
```bash
./deploy-multi-region-fixed.sh
```

**Optional parameters:**
```bash
./deploy-multi-region-fixed.sh --project-name custom-name --environment dev
```

### Step 4: Verify Deployment

1. **Check the output** for:
   - CloudFront URL
   - API Gateway URL
   - Cognito User Pool details

2. **Test the API directly**:
   ```bash
   curl -X POST "YOUR_API_GATEWAY_URL/proxy" \
     -H "Content-Type: application/json" \
     -d '{"operation":"list_workloads","params":{}}'
   ```

3. **Access the web application** at the CloudFront URL

## File Structure and Dependencies

### Core Files (Required)
```
├── deploy-multi-region-fixed.sh          # Main deployment script
├── wa-visualizer-regional-secure.yaml    # Regional resources template
├── wa-visualizer-global.yaml             # Global resources template
├── wa-api-visualizer.html                # Web application
├── script-improved.js                    # JavaScript functionality
├── auth-overlay.js                       # Cognito authentication
└── lambda-proxy/                         # Lambda function directory
    ├── lambda_function_improved.py       # Main Lambda code
    ├── requirements.txt                  # Python dependencies
    └── [boto3/botocore libraries]        # AWS SDK
```

### Supporting Files
```
├── cleanup-multi-region-fixed.sh         # Cleanup script
├── DEPLOYMENT-GUIDE.md                   # This guide
└── README.md                             # Solution overview
```

## Code Updates Required for Different Environments

### 1. Email Domain Changes
**File:** `wa-visualizer-regional-secure.yaml`
**Location:** PreSignupLambda code section (line ~90)
```python
# Update this line with customer's domain:
if not email.endswith('@customer-domain.com'):
```

### 2. Project Name Changes
**File:** `deploy-multi-region-fixed.sh`
**Location:** Default values section (line ~10)
```bash
# Change default project name:
PROJECT_NAME="customer-wa-visualizer"
```

### 3. AWS Profile Changes
**File:** `deploy-multi-region-fixed.sh`
**Location:** Default values section (line ~15)
```bash
# Change default AWS profile:
AWS_PROFILE="customer-production"
```

### 4. Region Changes (if needed)
**File:** `deploy-multi-region-fixed.sh`
**Location:** Default values section (lines ~12-13)
```bash
# Change deployment regions:
REGIONAL_REGION="us-east-1"  # Change from ap-southeast-2
GLOBAL_REGION="us-east-1"    # Keep as us-east-1 for CloudFront
```

## Deployment Scripts and Order

### Primary Deployment
**Script:** `deploy-multi-region-fixed.sh`
**Order:** Single script handles all deployment steps
1. Creates Lambda S3 bucket
2. Builds and uploads Lambda function
3. Deploys regional CloudFormation stack
4. Deploys global CloudFormation stack
5. Uploads web application files
6. Configures API Gateway URL in JavaScript

### Cleanup
**Script:** `cleanup-multi-region-fixed.sh`
**Order:** Single script handles all cleanup
1. Empties S3 buckets
2. Deletes global CloudFormation stack
3. Deletes regional CloudFormation stack
4. Removes S3 buckets

## Environment-Specific Configurations

### Development Environment
```bash
./deploy-multi-region-fixed.sh --project-name wa-viz-dev --environment dev
```

### Staging Environment
```bash
./deploy-multi-region-fixed.sh --project-name wa-viz-staging --environment staging
```

### Production Environment
```bash
./deploy-multi-region-fixed.sh --project-name wa-viz-prod --environment prod
```

## Customer Deployment Checklist

### Pre-Deployment
- [ ] Update email domain in `wa-visualizer-regional-secure.yaml`
- [ ] Update project name in `deploy-multi-region-fixed.sh`
- [ ] Update AWS profile in `deploy-multi-region-fixed.sh`
- [ ] Verify AWS permissions
- [ ] Ensure Well-Architected workloads exist

### Deployment
- [ ] Run `./deploy-multi-region-fixed.sh`
- [ ] Verify CloudFormation stacks created successfully
- [ ] Test API Gateway endpoint directly
- [ ] Access web application via CloudFront URL
- [ ] Test user registration with customer email domain

### Post-Deployment
- [ ] Document CloudFront URL for users
- [ ] Document Cognito User Pool details
- [ ] Set up monitoring/alerting if required
- [ ] Provide user access instructions

## Troubleshooting

### Common Issues

#### 1. Email Domain Validation Fails
**Symptom:** Users can't register with their email
**Solution:** Check PreSignupLambda code has correct domain

#### 2. API Gateway Returns 403/404
**Symptom:** Web app can't load workloads
**Solution:** Check API Gateway URL in `script-improved.js`

#### 3. CloudFront Shows Old Content
**Symptom:** Changes not reflected in web app
**Solution:** Invalidate CloudFront cache:
```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

#### 4. Lambda Function Timeout
**Symptom:** API calls fail after 3 seconds
**Solution:** Lambda timeout is automatically set to 30 seconds in the template

### Verification Commands

```bash
# Check CloudFormation stacks
aws cloudformation describe-stacks --region ap-southeast-2
aws cloudformation describe-stacks --region us-east-1

# Test API Gateway
curl -X POST "YOUR_API_URL/proxy" \
  -H "Content-Type: application/json" \
  -d '{"operation":"list_workloads","params":{}}'

# Check Lambda function
aws lambda get-function --function-name wa-visualizer-proxy --region ap-southeast-2

# Check Cognito User Pool
aws cognito-idp list-user-pools --max-results 10 --region ap-southeast-2
```

## Security Considerations

### Email Domain Restriction
- Only specified domain emails can register
- Pre-signup Lambda validates email domain
- Auto-confirms valid domain users

### MFA Requirement
- All users must set up MFA
- Software token MFA enabled by default

### Network Security
- HTTPS only via CloudFront
- API Gateway with CORS configured
- No direct S3 bucket access

### IAM Permissions
- Lambda uses minimal required permissions
- Only Well-Architected API access granted

## Support and Maintenance

### Regular Updates
- Monitor AWS service updates
- Update Lambda runtime when needed
- Review security patches

### Monitoring
- CloudWatch logs for Lambda function
- CloudFront access logs
- API Gateway metrics

### Backup
- CloudFormation templates serve as infrastructure backup
- Lambda code stored in S3
- Web application files in S3

---

**Need Help?** 
- Check CloudWatch logs for detailed error information
- Review the troubleshooting section above
- Verify all prerequisites are met
