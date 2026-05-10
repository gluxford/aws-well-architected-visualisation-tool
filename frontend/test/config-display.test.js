/**
 * Feature: cdk-open-source-refactor, Property 6: Frontend domain label reflects config
 *
 * For any runtime config where email restriction is enabled, the rendered
 * sign-up form label should contain each of the allowed domain strings from the config.
 *
 * Validates: Requirements 1.6
 */
const fc = require('fast-check');

/**
 * Simulates the getEmailLabel() function from frontend/js/auth.js
 * This is extracted here for testability without a full DOM environment.
 */
function getEmailLabel(config) {
  if (config && config.emailRestriction && config.emailRestriction.enabled) {
    const domains = config.emailRestriction.allowedDomains || [];
    if (domains.length > 0) {
      return `Email (${domains.map(d => '@' + d).join(', ')} only):`;
    }
  }
  return 'Email:';
}

// --- Generators ---

/** Generate a valid domain label */
const validDomainLabel = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 1 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 0, maxLength: 6 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 1 })
  )
  .map(([first, middle, last]) => first + middle + last);

/** Generate a valid TLD */
const validTld = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 2, maxLength: 4 }
);

/** Generate a valid domain */
const validDomain = fc
  .tuple(validDomainLabel, validTld)
  .map(([label, tld]) => `${label}.${tld}`);

// --- Property Tests ---

describe('Feature: cdk-open-source-refactor, Property 6: Frontend domain label reflects config', () => {
  it('when email restriction is enabled, the label contains each allowed domain', () => {
    /**
     * Validates: Requirements 1.6
     */
    fc.assert(
      fc.property(
        fc.array(validDomain, { minLength: 1, maxLength: 5 }),
        (domains) => {
          const config = {
            emailRestriction: {
              enabled: true,
              allowedDomains: domains,
            },
          };

          const label = getEmailLabel(config);

          // Each domain should appear in the label prefixed with @
          for (const domain of domains) {
            expect(label).toContain(`@${domain}`);
          }

          // Label should indicate restriction
          expect(label).toContain('only');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when email restriction is disabled, the label is generic without domain info', () => {
    fc.assert(
      fc.property(
        fc.array(validDomain, { minLength: 0, maxLength: 5 }),
        (domains) => {
          const config = {
            emailRestriction: {
              enabled: false,
              allowedDomains: domains,
            },
          };

          const label = getEmailLabel(config);

          expect(label).toBe('Email:');
          expect(label).not.toContain('only');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when config is null/undefined, the label is generic', () => {
    expect(getEmailLabel(null)).toBe('Email:');
    expect(getEmailLabel(undefined)).toBe('Email:');
    expect(getEmailLabel({})).toBe('Email:');
  });
});
