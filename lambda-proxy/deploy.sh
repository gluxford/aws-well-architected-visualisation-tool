#!/bin/bash

# Configuration
PROFILE="mymlplayground"
REGION="ap-southeast-2"
BUCKET="wellarchitected-proxy-deployment-288206176536"
STACK_NAME="wellarchitected-proxy"
FUNCTION_NAME="wellarchitected-proxy"
ROLE_NAME="wellarchitected-proxy-role"
POLICY_NAME="WellArchitectedToolReadOnlyAccess"
ORG_ID="o-9u3cmdxs6m"  # Replace with your actual AWS Organization ID

# Update the Organization ID in the trust policy
sed -i '' "s/o-a1b2c3d4e5/$ORG_ID/g" trust-policy.json

echo "Creating IAM role with organization trust policy..."
ROLE_ARN=$(aws iam create-role --role-name $ROLE_NAME \
  --assume-role-policy-document file://trust-policy.json \
  --profile $PROFILE --query 'Role.Arn' --output text)

echo "Creating WellArchitected read-only policy..."
POLICY_ARN=$(aws iam create-policy --policy-name $POLICY_NAME \
  --policy-document file://wellarchitected-policy.json \
  --profile $PROFILE --query 'Policy.Arn' --output text)

echo "Attaching policies to role..."
aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn $POLICY_ARN \
  --profile $PROFILE

aws iam attach-role-policy --role-name $ROLE_NAME \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --profile $PROFILE

echo "Packaging Lambda function..."
zip -r function.zip lambda_function.py

echo "Uploading Lambda package to S3..."
aws s3 cp function.zip s3://$BUCKET/ --profile $PROFILE

echo "Creating/updating Lambda function..."
FUNCTION_ARN=$(aws lambda create-function --function-name $FUNCTION_NAME \
  --runtime python3.9 --handler lambda_function.lambda_handler \
  --role $ROLE_ARN --code S3Bucket=$BUCKET,S3Key=function.zip \
  --timeout 30 --memory-size 256 \
  --profile $PROFILE --region $REGION --query 'FunctionArn' --output text 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "Function already exists, updating code..."
  aws lambda update-function-code --function-name $FUNCTION_NAME \
    --s3-bucket $BUCKET --s3-key function.zip \
    --profile $PROFILE --region $REGION
fi

echo "Creating API Gateway..."
API_ID=$(aws apigateway create-rest-api --name WellArchitectedProxy \
  --endpoint-configuration types=REGIONAL \
  --profile $PROFILE --region $REGION --query 'id' --output text)

ROOT_ID=$(aws apigateway get-resources --rest-api-id $API_ID \
  --profile $PROFILE --region $REGION --query 'items[0].id' --output text)

echo "Creating API Gateway resource and methods..."
RESOURCE_ID=$(aws apigateway create-resource --rest-api-id $API_ID \
  --parent-id $ROOT_ID --path-part proxy \
  --profile $PROFILE --region $REGION --query 'id' --output text)

# Create POST method
aws apigateway put-method --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID --http-method POST \
  --authorization-type NONE \
  --profile $PROFILE --region $REGION

# Create OPTIONS method for CORS
aws apigateway put-method --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID --http-method OPTIONS \
  --authorization-type NONE \
  --profile $PROFILE --region $REGION

# Set up Lambda integration for POST
aws apigateway put-integration --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID --http-method POST \
  --type AWS_PROXY --integration-http-method POST \
  --uri arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$FUNCTION_ARN/invocations \
  --profile $PROFILE --region $REGION

# Set up mock integration for OPTIONS
aws apigateway put-integration --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID --http-method OPTIONS \
  --type MOCK --integration-http-method OPTIONS \
  --request-templates '{"application/json": "{\"statusCode\": 200}"}' \
  --profile $PROFILE --region $REGION

# Set up CORS response for OPTIONS
aws apigateway put-integration-response --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": "'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'",
    "method.response.header.Access-Control-Allow-Methods": "'"'"'OPTIONS,POST'"'"'",
    "method.response.header.Access-Control-Allow-Origin": "'"'"'*'"'"'"
  }' \
  --profile $PROFILE --region $REGION

# Set up method response for OPTIONS
aws apigateway put-method-response --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{
    "method.response.header.Access-Control-Allow-Headers": true,
    "method.response.header.Access-Control-Allow-Methods": true,
    "method.response.header.Access-Control-Allow-Origin": true
  }' \
  --profile $PROFILE --region $REGION

echo "Adding IP restriction to API Gateway..."
aws apigateway update-rest-api --rest-api-id $API_ID \
  --patch-operations op=replace,path=/policy,value='{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": "*",
        "Action": "execute-api:Invoke",
        "Resource": "*"
      },
      {
        "Effect": "Deny",
        "Principal": "*",
        "Action": "execute-api:Invoke",
        "Resource": "*",
        "Condition": {
          "NotIpAddress": {
            "aws:SourceIp": "159.196.13.45/32"
          }
        }
      }
    ]
  }' \
  --profile $PROFILE --region $REGION

echo "Deploying API Gateway..."
aws apigateway create-deployment --rest-api-id $API_ID \
  --stage-name prod \
  --profile $PROFILE --region $REGION

echo "Adding Lambda permission for API Gateway..."
aws lambda add-permission --function-name $FUNCTION_NAME \
  --statement-id apigateway-prod \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:$REGION:$(aws sts get-caller-identity --profile $PROFILE --query 'Account' --output text):$API_ID/*/POST/proxy" \
  --profile $PROFILE --region $REGION

echo "Deployment complete!"
echo "API Gateway URL: https://$API_ID.execute-api.$REGION.amazonaws.com/prod/proxy"
