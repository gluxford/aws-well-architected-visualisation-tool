"""
Feature: cdk-open-source-refactor, Property 5: CORS origin correctness

For any response from the Proxy Lambda, the Access-Control-Allow-Origin header
should equal the ALLOWED_ORIGIN environment variable value. It should never be '*'
when ALLOWED_ORIGIN is explicitly set to a domain.

Validates: Requirements 11.1, 11.3
"""
import json
import os
import pytest
from unittest.mock import patch, MagicMock
from hypothesis import given, settings, assume
from hypothesis import strategies as st


# --- Strategies ---

# Valid domain for ALLOWED_ORIGIN
domain_label = st.from_regex(r'[a-z][a-z0-9-]{0,10}[a-z0-9]', fullmatch=True)
tld = st.from_regex(r'[a-z]{2,6}', fullmatch=True)
valid_origin = st.builds(
    lambda label, t: f'https://{label}.{t}',
    domain_label,
    tld
)

# Valid operations the lambda supports
valid_operation = st.sampled_from([
    'list_workloads', 'get_workload', 'list_lens_reviews',
    'get_lens_review', 'list_answers', 'get_answer'
])


def make_api_event(operation: str, params: dict = None) -> dict:
    """Create an API Gateway proxy event."""
    return {
        'httpMethod': 'POST',
        'body': json.dumps({
            'operation': operation,
            'params': params or {}
        }),
        'requestContext': {
            'identity': {
                'sourceIp': '127.0.0.1'
            }
        }
    }


def make_options_event() -> dict:
    """Create an OPTIONS preflight event."""
    return {
        'httpMethod': 'OPTIONS',
        'body': None,
        'requestContext': {
            'identity': {
                'sourceIp': '127.0.0.1'
            }
        }
    }


class TestCorsOriginCorrectness:
    """Property 5: CORS origin correctness."""

    @settings(max_examples=100)
    @given(origin=valid_origin)
    def test_options_response_uses_allowed_origin(self, origin):
        """OPTIONS preflight response uses the ALLOWED_ORIGIN env var."""
        with patch.dict(os.environ, {'ALLOWED_ORIGIN': origin, 'AWS_REGION': 'us-east-1'}):
            # Re-import to pick up env changes
            import importlib
            import lambda_function
            importlib.reload(lambda_function)

            event = make_options_event()
            result = lambda_function.lambda_handler(event, None)

            assert result['headers']['Access-Control-Allow-Origin'] == origin

    @settings(max_examples=100)
    @given(origin=valid_origin, operation=valid_operation)
    def test_post_response_uses_allowed_origin(self, origin, operation):
        """POST response uses the ALLOWED_ORIGIN env var regardless of operation."""
        with patch.dict(os.environ, {'ALLOWED_ORIGIN': origin, 'AWS_REGION': 'us-east-1'}):
            import importlib
            import lambda_function
            importlib.reload(lambda_function)

            # Mock boto3 clients to avoid real AWS calls
            mock_wa_client = MagicMock()
            mock_sts_client = MagicMock()
            mock_sts_client.get_caller_identity.return_value = {
                'Account': '123456789012',
                'Arn': 'arn:aws:iam::123456789012:role/test'
            }

            # For list_workloads, return empty result
            mock_wa_client.list_workloads.return_value = {
                'WorkloadSummaries': [],
                'ResponseMetadata': {}
            }
            # For other operations, return a generic response
            for op in ['get_workload', 'list_lens_reviews', 'get_lens_review', 'list_answers', 'get_answer']:
                getattr(mock_wa_client, op).return_value = {'ResponseMetadata': {}}

            with patch('lambda_function.boto3') as mock_boto3:
                mock_boto3.client.side_effect = lambda service, **kwargs: (
                    mock_wa_client if service == 'wellarchitected' else mock_sts_client
                )
                mock_boto3.__version__ = '1.26.0'

                with patch('lambda_function.botocore') as mock_botocore:
                    mock_botocore.__version__ = '1.29.0'

                    event = make_api_event(operation)
                    result = lambda_function.lambda_handler(event, None)

                    assert result['headers']['Access-Control-Allow-Origin'] == origin

    @settings(max_examples=100)
    @given(origin=valid_origin)
    def test_error_response_still_uses_allowed_origin(self, origin):
        """Even error responses use the correct ALLOWED_ORIGIN."""
        with patch.dict(os.environ, {'ALLOWED_ORIGIN': origin, 'AWS_REGION': 'us-east-1'}):
            import importlib
            import lambda_function
            importlib.reload(lambda_function)

            # Send an event with invalid body to trigger an error
            event = {
                'httpMethod': 'POST',
                'body': 'not valid json',
                'requestContext': {'identity': {'sourceIp': '127.0.0.1'}}
            }
            result = lambda_function.lambda_handler(event, None)

            assert result['statusCode'] == 500
            assert result['headers']['Access-Control-Allow-Origin'] == origin

    def test_default_origin_is_wildcard_when_env_not_set(self):
        """When ALLOWED_ORIGIN is not set, defaults to '*'."""
        env = os.environ.copy()
        env.pop('ALLOWED_ORIGIN', None)
        env['AWS_REGION'] = 'us-east-1'

        with patch.dict(os.environ, env, clear=True):
            import importlib
            import lambda_function
            importlib.reload(lambda_function)

            event = make_options_event()
            result = lambda_function.lambda_handler(event, None)

            assert result['headers']['Access-Control-Allow-Origin'] == '*'
