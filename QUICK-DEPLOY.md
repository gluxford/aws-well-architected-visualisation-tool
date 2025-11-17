# Quick Deployment Reference

## For Cevo Deployments
```bash
# 1. Set AWS profile
export AWS_PROFILE=cevo-production

# 2. Deploy (uses cevo.com.au emails by default)
./deploy-multi-region-fixed.sh

# 3. Access application at provided CloudFront URL
```

## For Customer Deployments

### 1. Update Email Domain
**File:** `wa-visualizer-regional-secure.yaml` (line ~90)
```python
# Change from:
if not email.endswith('@cevo.com.au'):

# To:
if not email.endswith('@customer-domain.com'):
```

### 2. Update Project Settings
**File:** `deploy-multi-region-fixed.sh` (lines 10-15)
```bash
PROJECT_NAME="customer-wa-visualizer"
AWS_PROFILE="customer-production"
```

### 3. Deploy
```bash
./deploy-multi-region-fixed.sh --project-name customer-wa-viz --environment prod
```

## Files That Need Updates

| File | What to Change | Why |
|------|----------------|-----|
| `wa-visualizer-regional-secure.yaml` | Email domain in PreSignupLambda | Email validation |
| `deploy-multi-region-fixed.sh` | PROJECT_NAME, AWS_PROFILE | Environment settings |

## Deployment Order
1. **Single Script:** `deploy-multi-region-fixed.sh`
   - Creates Lambda S3 bucket
   - Builds Lambda function
   - Deploys regional stack (ap-southeast-2)
   - Deploys global stack (us-east-1)
   - Uploads web files
   - Updates JavaScript with correct API URL

## Cleanup
```bash
./cleanup-multi-region-fixed.sh
```

## Test Deployment
```bash
# Test API directly
curl -X POST "YOUR_API_URL/proxy" \
  -H "Content-Type: application/json" \
  -d '{"operation":"list_workloads","params":{}}'
```
