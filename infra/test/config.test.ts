import * as fc from 'fast-check';
import { validateConfig } from '../lib/config';

/**
 * Feature: cdk-open-source-refactor, Property 1: Configuration validation
 *
 * For any configuration object, the config validator should accept it if and only if:
 * (a) emailRestriction.enabled is a boolean,
 * (b) when enabled is true, allowedDomains is a non-empty array of valid domain strings,
 * (c) primaryRegion is a valid AWS region string,
 * (d) projectName is a non-empty alphanumeric-with-hyphens string starting with a letter,
 * (e) mfa is one of "required", "optional", or "off", and
 * (f) customDomain is either null/undefined or contains both domainName and certificateArn.
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 5.1, 6.1, 12.1
 */

// --- Generators ---

/** Generate a valid project name: starts with a letter, followed by alphanumeric/hyphens */
const validProjectName = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 1 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'.split('')), { minLength: 0, maxLength: 20 })
  )
  .map(([first, rest]) => first + rest);

/** Generate a valid AWS region string matching the pattern */
const validRegion = fc
  .tuple(
    fc.constantFrom('us', 'eu', 'ap', 'sa', 'ca', 'me', 'af'),
    fc.constantFrom('', '-gov'),
    fc.constantFrom('north', 'south', 'east', 'west', 'central', 'northeast', 'southeast', 'northwest', 'southwest'),
    fc.integer({ min: 1, max: 9 })
  )
  .map(([prefix, gov, direction, num]) => `${prefix}${gov}-${direction}-${num}`);

/** Generate a valid domain label (alphanumeric, may contain hyphens in the middle) */
const validDomainLabel = fc
  .tuple(
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 1 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 0, maxLength: 8 }),
    fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 1, maxLength: 1 })
  )
  .map(([first, middle, last]) => first + middle + last);

/** Generate a valid TLD (2+ alpha characters) */
const validTld = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
  { minLength: 2, maxLength: 6 }
);

/** Generate a valid domain string matching DOMAIN_PATTERN */
const validDomain = fc
  .tuple(
    fc.array(validDomainLabel, { minLength: 1, maxLength: 3 }),
    validTld
  )
  .map(([labels, tld]) => [...labels, tld].join('.'));

/** Generate a valid emailRestriction object */
const validEmailRestriction = fc.oneof(
  // enabled=false: no domains needed
  fc.constant({ enabled: false }),
  // enabled=true: non-empty array of valid domains
  fc.array(validDomain, { minLength: 1, maxLength: 5 }).map((domains) => ({
    enabled: true,
    allowedDomains: domains,
  }))
);

/** Generate a valid MFA value */
const validMfa = fc.constantFrom('required', 'optional', 'off');

/** Generate a valid customDomain (null/undefined or object with both fields) */
const validCustomDomain = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.tuple(validDomain, fc.constant('arn:aws:acm:us-east-1:123456789012:certificate/abc-123')).map(
    ([domainName, certificateArn]) => ({ domainName, certificateArn })
  )
);

/** Generate a complete valid configuration object */
const validConfig = fc.record({
  projectName: validProjectName,
  primaryRegion: validRegion,
  emailRestriction: validEmailRestriction,
  mfa: validMfa,
  customDomain: validCustomDomain,
});

// --- Property Tests ---

describe('Feature: cdk-open-source-refactor, Property 1: Configuration validation', () => {
  it('valid configs are always accepted', () => {
    /**
     * Validates: Requirements 1.1, 1.2, 2.1, 5.1, 6.1, 12.1
     */
    fc.assert(
      fc.property(validConfig, (config) => {
        // A valid config should never throw
        const result = validateConfig(config);
        expect(result).toBeDefined();
        expect(result.projectName).toBe(config.projectName);
        expect(result.primaryRegion).toBe(config.primaryRegion);
        expect(result.mfa).toBe(config.mfa);
      }),
      { numRuns: 100 }
    );
  });

  it('invalid projectName is always rejected', () => {
    /**
     * Validates: Requirements 5.1
     */
    const invalidProjectName = fc.oneof(
      // Starts with a digit
      fc.tuple(
        fc.stringOf(fc.constantFrom(...'0123456789'.split('')), { minLength: 1, maxLength: 1 }),
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')), { minLength: 0, maxLength: 10 })
      ).map(([first, rest]) => first + rest),
      // Contains special characters
      fc.tuple(
        fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 1 }),
        fc.stringOf(fc.constantFrom(...'!@#$%^&*()_+=[]{}|;:,.<>?/~`'.split('')), { minLength: 1, maxLength: 5 })
      ).map(([first, rest]) => first + rest),
      // Empty string
      fc.constant('')
    );

    fc.assert(
      fc.property(
        invalidProjectName,
        validRegion,
        validEmailRestriction,
        validMfa,
        validCustomDomain,
        (projectName, primaryRegion, emailRestriction, mfa, customDomain) => {
          const config = { projectName, primaryRegion, emailRestriction, mfa, customDomain };
          expect(() => validateConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid region is always rejected', () => {
    /**
     * Validates: Requirements 2.1
     */
    const invalidRegion = fc.oneof(
      // Random strings that don't match the AWS region pattern
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 5 }),
      // Missing direction component
      fc.tuple(
        fc.constantFrom('us', 'eu', 'ap'),
        fc.integer({ min: 1, max: 9 })
      ).map(([prefix, num]) => `${prefix}-${num}`),
      // Invalid direction
      fc.tuple(
        fc.constantFrom('us', 'eu', 'ap'),
        fc.constantFrom('middle', 'upper', 'lower', 'far'),
        fc.integer({ min: 1, max: 9 })
      ).map(([prefix, direction, num]) => `${prefix}-${direction}-${num}`),
      // Empty string
      fc.constant('')
    );

    fc.assert(
      fc.property(
        validProjectName,
        invalidRegion,
        validEmailRestriction,
        validMfa,
        validCustomDomain,
        (projectName, primaryRegion, emailRestriction, mfa, customDomain) => {
          const config = { projectName, primaryRegion, emailRestriction, mfa, customDomain };
          expect(() => validateConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when emailRestriction.enabled=true and allowedDomains is empty/missing, always rejected', () => {
    /**
     * Validates: Requirements 1.2
     */
    const invalidEmailRestriction = fc.oneof(
      // enabled=true with empty array
      fc.constant({ enabled: true, allowedDomains: [] }),
      // enabled=true with missing allowedDomains
      fc.constant({ enabled: true }),
      // enabled=true with undefined allowedDomains
      fc.constant({ enabled: true, allowedDomains: undefined })
    );

    fc.assert(
      fc.property(
        validProjectName,
        validRegion,
        invalidEmailRestriction,
        validMfa,
        validCustomDomain,
        (projectName, primaryRegion, emailRestriction, mfa, customDomain) => {
          const config = { projectName, primaryRegion, emailRestriction, mfa, customDomain };
          expect(() => validateConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid mfa values are always rejected', () => {
    /**
     * Validates: Requirements 6.1
     */
    const invalidMfa = fc.oneof(
      fc.constantFrom('on', 'enabled', 'disabled', 'true', 'false', 'yes', 'no', 'mandatory'),
      fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 1, maxLength: 10 })
        .filter((s) => !['required', 'optional', 'off'].includes(s))
    );

    fc.assert(
      fc.property(
        validProjectName,
        validRegion,
        validEmailRestriction,
        invalidMfa,
        validCustomDomain,
        (projectName, primaryRegion, emailRestriction, mfa, customDomain) => {
          const config = { projectName, primaryRegion, emailRestriction, mfa, customDomain };
          expect(() => validateConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid customDomain (missing fields) is always rejected', () => {
    /**
     * Validates: Requirements 12.1
     */
    const invalidCustomDomain = fc.oneof(
      // Object with only domainName
      fc.constant({ domainName: 'example.com' }),
      // Object with only certificateArn
      fc.constant({ certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc' }),
      // Object with empty domainName
      fc.constant({ domainName: '', certificateArn: 'arn:aws:acm:us-east-1:123456789012:certificate/abc' }),
      // Object with empty certificateArn
      fc.constant({ domainName: 'example.com', certificateArn: '' })
    );

    fc.assert(
      fc.property(
        validProjectName,
        validRegion,
        validEmailRestriction,
        validMfa,
        invalidCustomDomain,
        (projectName, primaryRegion, emailRestriction, mfa, customDomain) => {
          const config = { projectName, primaryRegion, emailRestriction, mfa, customDomain };
          expect(() => validateConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});
