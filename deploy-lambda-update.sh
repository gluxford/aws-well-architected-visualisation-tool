#!/bin/bash

# This script updates the Lambda function with the new code

# Set your AWS region and Lambda function name
REGION="ap-southeast-2"  # Change this to your region
FUNCTION_NAME="WellArchitectedProxy"  # Change this to your Lambda function name

# Update the Lambda function code
echo "Updating Lambda function code..."
aws lambda update-function-code --profile mymlplayground \
  --region $REGION \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://lambda-proxy/function.zip

echo "Lambda function updated successfully!"
