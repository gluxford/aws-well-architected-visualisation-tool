import json
import boto3
import os
import logging
import ipaddress
import traceback
import botocore
from typing import Dict, Any, Optional, List, Union
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Allowed IP address - make this configurable via environment variable
ALLOWED_IP: str = os.environ.get('ALLOWED_IP', '159.196.13.45/32')

def is_ip_allowed(source_ip: str) -> bool:
    """Check if the source IP is in the allowed range"""
    try:
        # Handle multiple IP addresses separated by commas
        allowed_ips = [ip.strip() for ip in ALLOWED_IP.split(',')]
        client_ip = ipaddress.ip_address(source_ip)
        
        for allowed_ip in allowed_ips:
            allowed_network = ipaddress.ip_network(allowed_ip)
            if client_ip in allowed_network:
                return True
        return False
    except Exception as e:
        logger.error(f"Error checking IP address: {str(e)}")
        return False

def normalize_risk_counts(risk_counts: Dict[str, int]) -> tuple[Dict[str, int], int]:
    """Normalize risk counts to handle UNANSWERED questions"""
    normalized = {
        'HIGH': risk_counts.get('HIGH', 0),
        'MEDIUM': risk_counts.get('MEDIUM', 0),
        'NONE': risk_counts.get('NONE', 0),
        'UNANSWERED': risk_counts.get('UNANSWERED', 0),
        'NOT_APPLICABLE': risk_counts.get('NOT_APPLICABLE', 0)
    }
    
    # Calculate compliance percentage as integer
    total_questions = sum(normalized.values())
    if total_questions > 0:
        compliant = normalized['NONE']
        compliance_percentage = round((compliant / total_questions) * 100)
    else:
        compliance_percentage = 0
    
    return normalized, compliance_percentage

def get_workload_data(wa_client: Any, params: Dict[str, Any], headers: Dict[str, str]) -> Dict[str, Any]:
    """Custom operation to get comprehensive workload data"""
    try:
        workload_id = params.get('WorkloadId')
        if not workload_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'WorkloadId is required'})
            }
        
        logger.info(f"Getting comprehensive data for workload: {workload_id}")
        
        # Get workload details
        workload_response = wa_client.get_workload(WorkloadId=workload_id)
        workload = workload_response['Workload']
        
        # Get lens reviews
        lens_reviews_response = wa_client.list_lens_reviews(WorkloadId=workload_id)
        
        # Find the Well-Architected Framework lens
        wa_lens = None
        for lens in lens_reviews_response['LensReviewSummaries']:
            if lens['LensAlias'] == 'wellarchitected':
                wa_lens = lens
                break
        
        if not wa_lens:
            logger.warning(f"Well-Architected Framework lens not found for workload {workload_id}")
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Well-Architected Framework lens not found for this workload'})
            }
        
        # Get detailed lens review
        lens_review_response = wa_client.get_lens_review(
            WorkloadId=workload_id,
            LensAlias='wellarchitected'
        )
        lens_review = lens_review_response['LensReview']
        
        # Normalize risk counts
        normalized_risks, compliance_percentage = normalize_risk_counts(workload['RiskCounts'])
        
        # Process pillar data
        pillars = []
        for pillar in lens_review['PillarReviewSummaries']:
            pillar_risks, pillar_compliance = normalize_risk_counts(pillar['RiskCounts'])
            pillars.append({
                'id': pillar['PillarId'],
                'name': pillar['PillarName'],
                'riskCounts': pillar_risks,
                'compliance': pillar_compliance
            })
        
        # Prepare comprehensive response
        response_data = {
            'workloadId': workload['WorkloadId'],
            'workloadName': workload['WorkloadName'],
            'workloadArn': workload['WorkloadArn'],
            'description': workload.get('Description', ''),
            'environment': workload.get('Environment', ''),
            'ownerName': workload.get('ReviewOwner', ''),
            'accountIds': workload.get('AccountIds', [workload.get('Owner', '')]),
            'regions': workload.get('AwsRegions', []),
            'industry': workload.get('Industry', ''),
            'updatedAt': workload.get('UpdatedAt', ''),
            'riskCounts': {
                'high': normalized_risks['HIGH'],
                'medium': normalized_risks['MEDIUM'],
                'compliant': normalized_risks['NONE'],
                'unanswered': normalized_risks['UNANSWERED'],
                'notApplicable': normalized_risks['NOT_APPLICABLE']
            },
            'overallCompliance': compliance_percentage,
            'pillars': pillars,
            'lensVersion': lens_review.get('LensVersion', ''),
            'lensStatus': lens_review.get('LensStatus', ''),
            'hasUnansweredQuestions': normalized_risks['UNANSWERED'] > 0
        }
        
        logger.info(f"Successfully processed workload data for {workload_id}")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response_data, default=str)
        }
        
    except Exception as e:
        logger.error(f"Error in get_workload_data: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'Error processing workload data: {str(e)}'})
        }

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    # Set CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    }
    
    # Log the entire event for debugging
    logger.info(f"Received event: {json.dumps(event)}")
    
    # Handle preflight OPTIONS request
    if event['httpMethod'] == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({})
        }
    
    try:
        # Get client IP address
        source_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', '')
        logger.info(f"Request from IP: {source_ip}")
        
        # Parse request body
        body = json.loads(event['body'])
        operation = body.get('operation')
        params = body.get('params', {})
        
        logger.info(f"Received request for operation: {operation}")
        logger.info(f"Parameters: {json.dumps(params)}")
        
        # Create WellArchitected client using the Lambda's role
        region = os.environ.get('AWS_REGION', 'ap-southeast-2')
        logger.info(f"Using region: {region}")
        wa_client = boto3.client('wellarchitected', region_name=region)
        
        # Log boto3 versions for debugging
        logger.info(f"boto3 version: {boto3.__version__}")
        logger.info(f"botocore version: {botocore.__version__}")
        
        # Get AWS identity for debugging
        sts_client = boto3.client('sts', region_name=region)
        identity = sts_client.get_caller_identity()
        logger.info(f"AWS Identity: {json.dumps(identity)}")
        
        # Handle custom operations
        if operation == 'get_workload_data':
            logger.info("Handling custom operation: get_workload_data")
            return get_workload_data(wa_client, params, headers)
        
        # Map operation names to actual SDK method names
        operation_mapping = {
            'list_workloads': 'list_workloads',
            'get_workload': 'get_workload',
            'list_lens_reviews': 'list_lens_reviews',
            'get_lens_review': 'get_lens_review',
            'list_answers': 'list_answers',
            'get_answer': 'get_answer'
        }
        
        # Get the actual SDK method name
        sdk_operation = operation_mapping.get(operation, operation)
        
        if not sdk_operation:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': f'Unknown operation: {operation}'})
            }
        
        # Special handling for list_workloads to handle pagination
        if sdk_operation == 'list_workloads':
            logger.info("Handling list_workloads with pagination")
            all_workloads = []
            next_token = None
            
            while True:
                # Prepare parameters for this page
                page_params = params.copy()
                if next_token:
                    page_params['NextToken'] = next_token
                
                # Get this page of results
                page_response = wa_client.list_workloads(**page_params)
                
                # Add workloads from this page
                if 'WorkloadSummaries' in page_response:
                    all_workloads.extend(page_response['WorkloadSummaries'])
                
                # Check if there are more pages
                next_token = page_response.get('NextToken')
                if not next_token:
                    break
                
                logger.info(f"Retrieved {len(page_response.get('WorkloadSummaries', []))} workloads, continuing with NextToken")
            
            # Create combined response
            combined_response = {
                'WorkloadSummaries': all_workloads,
                'ResponseMetadata': page_response.get('ResponseMetadata', {})
            }
            
            logger.info(f"Total workloads retrieved: {len(all_workloads)}")
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(combined_response, default=str)
            }
        
        # Special handling for get_workload which needs WorkloadId
        if sdk_operation == 'get_workload' and 'WorkloadId' in params:
            # Check if WorkloadId is a full ARN and extract the ID if needed
            workload_id = params['WorkloadId']
            if workload_id.startswith('arn:aws:wellarchitected:'):
                # Extract the ID from the ARN
                workload_id = workload_id.split('/')[-1]
                params['WorkloadId'] = workload_id
                logger.info(f"Extracted WorkloadId from ARN: {workload_id}")
        
        # Execute the requested operation
        logger.info(f"Executing operation: {sdk_operation} with params: {json.dumps(params)}")
        
        try:
            response = getattr(wa_client, sdk_operation)(**params)
            logger.info(f"Operation {sdk_operation} completed successfully")
            logger.info(f"Response: {json.dumps(response, default=str)}")
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(response, default=str)
            }
            
        except Exception as api_error:
            logger.error(f"Error executing operation: {str(api_error)}")
            logger.error(traceback.format_exc())
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'API operation failed: {str(api_error)}'})
            }
            
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }
