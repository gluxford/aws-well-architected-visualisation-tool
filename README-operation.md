# Well-Architected Report Visualizer - Operation Guide

This guide provides instructions for operating and maintaining the Well-Architected Report Visualizer after deployment.

## Accessing the Visualizer

After deployment, you can access the Well-Architected Report Visualizer using one of the following URLs:

1. **S3 Website URL**: `http://<website-bucket-name>.s3-website-<region>.amazonaws.com`
2. **CloudFront URL** (if enabled): `https://<cloudfront-distribution-id>.cloudfront.net`

## Using the Visualizer

### Viewing Well-Architected Workloads

1. Open the visualizer in your web browser
2. You'll see a form with an input field for a workload ARN
3. You can either:
   - Enter a specific workload ARN and click "Fetch Workload"
   - Click "List Available Workloads" to see all workloads you have access to

### Interpreting the Report

The visualizer provides several sections:

1. **Workload Overview** - Basic information about the workload
2. **Risk Summary** - Count of high, medium, and low risk items
3. **Pillar Compliance** - Compliance scores for each Well-Architected pillar
4. **Recommendations** - Suggested improvements based on the assessment

## Maintenance Tasks

### Updating the Web Application

To update the web application files:

1. Modify the HTML, JavaScript, or CSS files as needed
2. Upload them to the deployment bucket:

```bash
aws s3 cp wa-summary.html s3://<deployment-bucket-name>/
aws s3 cp script.js s3://<deployment-bucket-name>/
aws s3 cp styles.css s3://<deployment-bucket-name>/
```

3. Redeploy the content stack:

```bash
aws cloudformation update-stack \
  --stack-name <stack-name>-content \
  --template-url https://<deployment-bucket-name>.s3.amazonaws.com/templates/wa-visualizer-content.yaml \
  --parameters ParameterKey=ProjectName,UsePreviousValue=true \
               ParameterKey=Environment,UsePreviousValue=true \
               ParameterKey=InfrastructureStackName,UsePreviousValue=true \
               ParameterKey=LambdaStackName,UsePreviousValue=true \
  --capabilities CAPABILITY_IAM
```

### Updating the Lambda Function

To modify the Lambda function code:

1. Update the Lambda function code in the `wa-visualizer-lambda.yaml` template
2. Upload the updated template to the deployment bucket:

```bash
aws s3 cp wa-visualizer-lambda.yaml s3://<deployment-bucket-name>/templates/
```

3. Update the Lambda stack:

```bash
aws cloudformation update-stack \
  --stack-name <stack-name>-lambda \
  --template-url https://<deployment-bucket-name>.s3.amazonaws.com/templates/wa-visualizer-lambda.yaml \
  --parameters ParameterKey=ProjectName,UsePreviousValue=true \
               ParameterKey=Environment,UsePreviousValue=true \
               ParameterKey=InfrastructureStackName,UsePreviousValue=true \
               ParameterKey=LambdaFunctionName,UsePreviousValue=true \
               ParameterKey=ApiGatewayName,UsePreviousValue=true \
               ParameterKey=ApiStageName,UsePreviousValue=true \
  --capabilities CAPABILITY_NAMED_IAM
```

## Monitoring

### Lambda Function Logs

To view the Lambda function logs:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/<lambda-function-name> \
  --filter-pattern "ERROR" \
  --start-time $(date -d "1 hour ago" +%s000)
```

### API Gateway Metrics

To monitor API Gateway usage:

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=<api-gateway-name> \
  --start-time $(date -d "1 day ago" +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date +%Y-%m-%dT%H:%M:%S) \
  --period 3600 \
  --statistics Sum
```

## Security Considerations

### IAM Permissions

The Lambda function uses an IAM role with the following permissions:

- `wellarchitected:Get*` - To retrieve Well-Architected workload data
- `wellarchitected:List*` - To list Well-Architected workloads

To modify these permissions:

1. Update the `WellArchitectedReadOnlyPolicy` in the `wa-visualizer-lambda.yaml` template
2. Upload the updated template and update the stack as described above

### API Gateway Security

By default, the API Gateway endpoint is publicly accessible. To restrict access:

1. Update the `ProxyPostMethod` in the `wa-visualizer-lambda.yaml` template to add API key requirements or other authorization methods
2. Consider implementing IP restrictions in the Lambda function code

## Troubleshooting

### Common Issues

1. **API Gateway 403 Errors**: Check the Lambda execution role permissions
2. **Missing Workloads**: Ensure the Lambda role has permissions to access the Well-Architected API
3. **CORS Errors**: Verify the API Gateway CORS configuration in the Lambda response headers

### Debugging Steps

1. Check Lambda function logs for errors
2. Test the API Gateway endpoint directly using curl:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"operation":"list_workloads","params":{}}' \
  <api-gateway-endpoint>
```

3. Verify the S3 bucket contents:

```bash
aws s3 ls s3://<website-bucket-name>/
```

## Backup and Recovery

The solution doesn't store any persistent data, as it retrieves information directly from the Well-Architected API. However, to back up the configuration:

1. Export the CloudFormation stack templates:

```bash
aws cloudformation get-template --stack-name <stack-name> > master-stack-backup.json
aws cloudformation get-template --stack-name <stack-name>-infra > infra-stack-backup.json
aws cloudformation get-template --stack-name <stack-name>-lambda > lambda-stack-backup.json
aws cloudformation get-template --stack-name <stack-name>-content > content-stack-backup.json
```

2. Back up the web application files:

```bash
aws s3 cp s3://<website-bucket-name>/ ./backup/ --recursive
```
