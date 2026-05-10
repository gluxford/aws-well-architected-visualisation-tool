import os
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    """Cognito Pre-Signup trigger that validates email domains."""
    allowed_domains_str = os.environ.get('ALLOWED_DOMAINS', '')
    allowed_domains = [d.strip().lower() for d in allowed_domains_str.split(',') if d.strip()]

    email = event['request']['userAttributes'].get('email', '')

    if not email or '@' not in email:
        raise Exception('A valid email address is required for registration.')

    domain = email.split('@')[1].lower()

    if allowed_domains and domain not in allowed_domains:
        raise Exception(f'Registration is restricted to the following domains: {", ".join(allowed_domains)}')

    # Auto-confirm user and verify email
    event['response']['autoConfirmUser'] = True
    event['response']['autoVerifyEmail'] = True

    logger.info(f'Pre-signup validation passed for email domain: {domain}')
    return event
