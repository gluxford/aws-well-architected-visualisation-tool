import json
import boto3
import os

def lambda_handler(event, context):
    # Set CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    }
    
    # Handle preflight OPTIONS request
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({})
        }
    
    try:
        # Parse request body
        body = json.loads(event['body'])
        operation = body.get('operation')
        params = body.get('params', {})
        credentials = body.get('credentials', {})
        
        # Create a session with the provided credentials
        session = boto3.Session(
            aws_access_key_id=credentials.get('accessKeyId'),
            aws_secret_access_key=credentials.get('secretAccessKey'),
            aws_session_token=credentials.get('sessionToken'),
            region_name=credentials.get('region', 'ap-southeast-2')
        )
        
        # Create WellArchitected client
        wa_client = session.client('wellarchitected')
        
        # Execute the requested operation
        response = getattr(wa_client, operation)(**params)
        
        # Return successful response
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response, default=str)
        }
    except Exception as e:
        # Return error response
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': str(e)
            })
        }
