# WellArchitected API Proxy

This Lambda function serves as a proxy for the AWS WellArchitected API, allowing browser-based applications to access the API without CORS issues.

## Troubleshooting Credentials

If you're experiencing issues with credentials, you can use the included `test-credentials.py` script to verify your AWS credentials:

```bash
python test-credentials.py <access_key> <secret_key> [session_token] [region]
```

This will attempt to list WellArchitected workloads using the provided credentials, which can help determine if the issue is with the credentials themselves or with the Lambda proxy.

## Common Issues

1. **Invalid Security Token**: This usually happens when:
   - The session token is provided but is invalid
   - The session token is needed but not provided
   - The access key or secret key is incorrect

2. **Region Issues**: Make sure the region specified matches where your WellArchitected workloads are located.

3. **Permission Issues**: Ensure the IAM user or role associated with the credentials has permissions to access the WellArchitected API.

## Lambda Function Details

The Lambda function:
1. Accepts requests with AWS credentials
2. Creates a boto3 session with those credentials
3. Makes the requested WellArchitected API call
4. Returns the results with proper CORS headers

## Security Considerations

- The Lambda function accepts AWS credentials in the request body
- Ensure your API Gateway is properly secured (e.g., with API keys)
- Consider implementing additional authentication mechanisms
- Use HTTPS for all communications
