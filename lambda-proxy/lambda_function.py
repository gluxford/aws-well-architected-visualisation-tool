import json
import boto3
import os
import logging
import ipaddress
import traceback
import botocore

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Allowed IP address
ALLOWED_IP = "159.196.13.45/32"

def is_ip_allowed(source_ip):
    """Check if the source IP is in the allowed range"""
    try:
        allowed_network = ipaddress.ip_network(ALLOWED_IP)
        client_ip = ipaddress.ip_address(source_ip)
        return client_ip in allowed_network
    except Exception as e:
        logger.error(f"Error checking IP address: {str(e)}")
        return False

def lambda_handler(event, context):
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
            'list_answers': 'list_answers'
        }
        
        # Get the actual SDK method name
        sdk_operation = operation_mapping.get(operation, operation)
        
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
        response = getattr(wa_client, sdk_operation)(**params)
        
        logger.info(f"Operation {sdk_operation} completed successfully")
        
        # Return successful response
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response, default=str)
        }
    except Exception as e:
        logger.error(f"Error executing operation: {str(e)}")
        logger.error(traceback.format_exc())
        # Return error response
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': str(e)
            })
        }

def get_workload_data(wa_client, params, headers):
    """
    Custom handler to get all workload data including real compliance scores
    """
    try:
        workload_id = params.get('workloadId')
        lens_alias = params.get('lensAlias', 'wellarchitected')
        
        if not workload_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Missing workloadId parameter'})
            }
        
        # Extract workload ID from ARN if needed
        if workload_id.startswith('arn:aws:wellarchitected:'):
            workload_id = workload_id.split('/')[-1]
        
        logger.info(f"Getting workload data for workload ID: {workload_id}, lens: {lens_alias}")
        
        # Get workload details
        workload = wa_client.get_workload(WorkloadId=workload_id)
        
        # Get lens review data
        lens_review = wa_client.get_lens_review(
            WorkloadId=workload_id,
            LensAlias=lens_alias
        )
        
        # Process pillar data and calculate compliance percentages
        pillars = []
        for pillar in lens_review['LensReview']['PillarReviewSummaries']:
            # Calculate total questions
            total = (
                pillar['RiskCounts'].get('HIGH', 0) + 
                pillar['RiskCounts'].get('MEDIUM', 0) + 
                pillar['RiskCounts'].get('LOW', 0) + 
                pillar['RiskCounts'].get('NONE', 0)
            )
            
            # Calculate compliant questions (NONE and LOW risk are considered compliant)
            compliant = pillar['RiskCounts'].get('NONE', 0) + pillar['RiskCounts'].get('LOW', 0)
            
            # Calculate compliance percentage
            compliance_percentage = round((compliant / total) * 100) if total > 0 else 0
            
            pillars.append({
                'pillarId': pillar['PillarId'],
                'pillarName': pillar['PillarName'],
                'compliancePercentage': compliance_percentage,
                'riskCounts': {
                    'high': pillar['RiskCounts'].get('HIGH', 0),
                    'medium': pillar['RiskCounts'].get('MEDIUM', 0),
                    'low': pillar['RiskCounts'].get('LOW', 0),
                    'none': pillar['RiskCounts'].get('NONE', 0)
                }
            })
        
        # Calculate overall compliance percentage
        total_risk_counts = {
            'high': 0,
            'medium': 0,
            'low': 0,
            'none': 0
        }
        
        for pillar in pillars:
            total_risk_counts['high'] += pillar['riskCounts']['high']
            total_risk_counts['medium'] += pillar['riskCounts']['medium']
            total_risk_counts['low'] += pillar['riskCounts']['low']
            total_risk_counts['none'] += pillar['riskCounts']['none']
        
        total_questions = (
            total_risk_counts['high'] + 
            total_risk_counts['medium'] + 
            total_risk_counts['low'] + 
            total_risk_counts['none']
        )
        
        total_compliant = total_risk_counts['none'] + total_risk_counts['low']
        overall_compliance = round((total_compliant / total_questions) * 100) if total_questions > 0 else 0
        
        # Get high and medium risk items for recommendations
        recommendations = []
        for pillar in lens_review['LensReview']['PillarReviewSummaries']:
            pillar_id = pillar['PillarId']
            
            # Get answers for this pillar
            answers = wa_client.list_answers(
                WorkloadId=workload_id,
                LensAlias=lens_alias,
                PillarId=pillar_id
            )
            
            # Filter for high and medium risk items
            for answer in answers.get('AnswerSummaries', []):
                if answer['Risk'] in ['HIGH', 'MEDIUM']:
                    # Get detailed answer info
                    detail = wa_client.get_answer(
                        WorkloadId=workload_id,
                        LensAlias=lens_alias,
                        QuestionId=answer['QuestionId']
                    )
                    
                    recommendations.append({
                        'title': answer['QuestionTitle'],
                        'pillarName': pillar['PillarName'],
                        'risk': answer['Risk'],
                        'improvementPlan': detail['Answer'].get('ImprovementPlan', ''),
                        'improvementPlanUrl': detail['Answer'].get('ImprovementPlanUrl', '')
                    })
        
        # Return the formatted data
        result = {
            'workloadName': workload['Workload']['WorkloadName'],
            'workloadDescription': workload['Workload'].get('Description', ''),
            'overallCompliance': overall_compliance,
            'pillars': pillars,
            'riskCounts': total_risk_counts,
            'recommendations': recommendations
        }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result, default=str)
        }
    except Exception as e:
        logger.error(f"Error in get_workload_data: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)})
        }
