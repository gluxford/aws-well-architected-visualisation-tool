"""
Feature: cdk-open-source-refactor, Property 2: Email domain validation correctness

For any email address and any list of allowed domains, when email restriction is enabled,
the PreSignup Lambda should allow registration if and only if the email's domain
(the part after @) matches one of the allowed domains. When email restriction is disabled
(empty ALLOWED_DOMAINS), the lambda should allow any email.

Validates: Requirements 1.3, 1.4, 1.5
"""
import os
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from unittest.mock import patch

# Import the lambda handler
from lambda_function import lambda_handler


# --- Strategies ---

# Valid email local parts (simplified)
email_local = st.from_regex(r'[a-z][a-z0-9._%+-]{0,20}', fullmatch=True)

# Valid domain labels
domain_label = st.from_regex(r'[a-z][a-z0-9-]{0,10}[a-z0-9]', fullmatch=True)

# Valid TLDs
tld = st.from_regex(r'[a-z]{2,6}', fullmatch=True)

# Valid domain
valid_domain = st.builds(
    lambda label, t: f'{label}.{t}',
    domain_label,
    tld
)

# Non-empty list of allowed domains
allowed_domains_list = st.lists(valid_domain, min_size=1, max_size=5)


def make_event(email: str) -> dict:
    """Create a Cognito pre-signup event."""
    return {
        'request': {
            'userAttributes': {
                'email': email
            }
        },
        'response': {}
    }


class TestEmailDomainValidation:
    """Property 2: Email domain validation correctness."""

    @settings(max_examples=100)
    @given(
        local=email_local,
        domains=allowed_domains_list,
        domain_index=st.integers(min_value=0, max_value=100)
    )
    def test_matching_domain_always_allowed(self, local, domains, domain_index):
        """When email domain matches an allowed domain, registration succeeds."""
        # Pick one of the allowed domains
        chosen_domain = domains[domain_index % len(domains)]
        email = f'{local}@{chosen_domain}'
        allowed_domains_str = ','.join(domains)

        with patch.dict(os.environ, {'ALLOWED_DOMAINS': allowed_domains_str}):
            event = make_event(email)
            result = lambda_handler(event, None)

            assert result['response']['autoConfirmUser'] is True
            assert result['response']['autoVerifyEmail'] is True

    @settings(max_examples=100)
    @given(
        local=email_local,
        allowed_domains=allowed_domains_list,
        other_domain=valid_domain
    )
    def test_non_matching_domain_always_rejected(self, local, allowed_domains, other_domain):
        """When email domain does NOT match any allowed domain, registration is rejected."""
        # Ensure other_domain is not in the allowed list
        assume(other_domain.lower() not in [d.lower() for d in allowed_domains])

        email = f'{local}@{other_domain}'
        allowed_domains_str = ','.join(allowed_domains)

        with patch.dict(os.environ, {'ALLOWED_DOMAINS': allowed_domains_str}):
            event = make_event(email)
            with pytest.raises(Exception, match='restricted'):
                lambda_handler(event, None)

    @settings(max_examples=100)
    @given(
        local=email_local,
        domain=valid_domain
    )
    def test_empty_allowed_domains_allows_any_email(self, local, domain):
        """When ALLOWED_DOMAINS is empty, any email domain is allowed."""
        email = f'{local}@{domain}'

        with patch.dict(os.environ, {'ALLOWED_DOMAINS': ''}):
            event = make_event(email)
            result = lambda_handler(event, None)

            assert result['response']['autoConfirmUser'] is True
            assert result['response']['autoVerifyEmail'] is True

    @settings(max_examples=100)
    @given(
        local=email_local,
        domain=valid_domain
    )
    def test_unset_allowed_domains_allows_any_email(self, local, domain):
        """When ALLOWED_DOMAINS env var is not set, any email domain is allowed."""
        email = f'{local}@{domain}'

        env = os.environ.copy()
        env.pop('ALLOWED_DOMAINS', None)

        with patch.dict(os.environ, env, clear=True):
            event = make_event(email)
            result = lambda_handler(event, None)

            assert result['response']['autoConfirmUser'] is True
            assert result['response']['autoVerifyEmail'] is True
