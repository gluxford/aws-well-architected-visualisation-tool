import boto3
import sys
import json

def test_credentials(access_key, secret_key, session_token=None, region='ap-southeast-2'):
    """Test AWS credentials by trying to list WellArchitected workloads."""
    print(f"Testing credentials with access key ending in: {access_key[-4:]}")
    print(f"Region: {region}")
    print(f"Session token provided: {bool(session_token)}")
    
    try:
        # Create session
        session_args = {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'region_name': region
        }
        
        if session_token:
            session_args['aws_session_token'] = session_token
            
        session = boto3.Session(**session_args)
        
        # Create WellArchitected client
        wa_client = session.client('wellarchitected')
        
        # Try to list workloads
        response = wa_client.list_workloads()
        
        print("Credentials are valid!")
        print(f"Found {len(response.get('WorkloadSummaries', []))} workloads")
        return True
    except Exception as e:
        print(f"Error testing credentials: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test-credentials.py <access_key> <secret_key> [session_token] [region]")
        sys.exit(1)
        
    access_key = sys.argv[1]
    secret_key = sys.argv[2]
    session_token = sys.argv[3] if len(sys.argv) > 3 else None
    region = sys.argv[4] if len(sys.argv) > 4 else 'ap-southeast-2'
    
    test_credentials(access_key, secret_key, session_token, region)
