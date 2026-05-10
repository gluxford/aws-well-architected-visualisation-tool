/**
 * Deployment configuration interface and validation for the
 * Well-Architected Report Visualizer CDK application.
 */

export interface DeploymentConfig {
  projectName: string;
  primaryRegion: string;
  emailRestriction: {
    enabled: boolean;
    allowedDomains?: string[];
  };
  mfa: 'required' | 'optional' | 'off';
  customDomain?: {
    domainName: string;
    certificateArn: string;
  };
}

const PROJECT_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/;
const AWS_REGION_PATTERN = /^[a-z]{2}(-gov)?-(north|south|east|west|central|northeast|southeast|northwest|southwest)-\d+$/;
const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const VALID_MFA_VALUES: ReadonlyArray<string> = ['required', 'optional', 'off'];

/**
 * Validates a raw configuration object and returns a typed DeploymentConfig.
 * Throws descriptive errors for invalid configurations.
 */
export function validateConfig(raw: unknown): DeploymentConfig {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Configuration must be a non-null object.');
  }

  const config = raw as Record<string, unknown>;

  // Validate projectName
  if (typeof config.projectName !== 'string' || config.projectName.length === 0) {
    throw new Error('projectName must be a non-empty string.');
  }
  if (!PROJECT_NAME_PATTERN.test(config.projectName)) {
    throw new Error(
      'projectName must start with a letter and contain only alphanumeric characters and hyphens.'
    );
  }

  // Validate primaryRegion
  if (typeof config.primaryRegion !== 'string' || config.primaryRegion.length === 0) {
    throw new Error('primaryRegion must be a non-empty string.');
  }
  if (!AWS_REGION_PATTERN.test(config.primaryRegion)) {
    throw new Error(
      `primaryRegion "${config.primaryRegion}" is not a valid AWS region (e.g., us-east-1, ap-southeast-2).`
    );
  }

  // Validate emailRestriction
  if (!config.emailRestriction || typeof config.emailRestriction !== 'object') {
    throw new Error('emailRestriction must be an object with an "enabled" boolean field.');
  }

  const emailRestriction = config.emailRestriction as Record<string, unknown>;

  if (typeof emailRestriction.enabled !== 'boolean') {
    throw new Error('emailRestriction.enabled must be a boolean.');
  }

  if (emailRestriction.enabled) {
    if (!Array.isArray(emailRestriction.allowedDomains) || emailRestriction.allowedDomains.length === 0) {
      throw new Error(
        'emailRestriction.allowedDomains must be a non-empty array when emailRestriction.enabled is true.'
      );
    }
    for (const domain of emailRestriction.allowedDomains) {
      if (typeof domain !== 'string' || !DOMAIN_PATTERN.test(domain)) {
        throw new Error(
          `emailRestriction.allowedDomains contains an invalid domain: "${domain}". Domains must be valid (e.g., "example.com").`
        );
      }
    }
  }

  // Validate mfa
  if (!VALID_MFA_VALUES.includes(config.mfa as string)) {
    throw new Error(`mfa must be one of: ${VALID_MFA_VALUES.join(', ')}. Received: "${config.mfa}".`);
  }

  // Validate customDomain (optional)
  if (config.customDomain !== null && config.customDomain !== undefined) {
    if (typeof config.customDomain !== 'object') {
      throw new Error('customDomain must be an object with "domainName" and "certificateArn" fields, or null/undefined.');
    }

    const customDomain = config.customDomain as Record<string, unknown>;

    if (typeof customDomain.domainName !== 'string' || customDomain.domainName.length === 0) {
      throw new Error('customDomain.domainName must be a non-empty string.');
    }
    if (typeof customDomain.certificateArn !== 'string' || customDomain.certificateArn.length === 0) {
      throw new Error('customDomain.certificateArn must be a non-empty string.');
    }
  }

  // Build and return typed config
  const validated: DeploymentConfig = {
    projectName: config.projectName as string,
    primaryRegion: config.primaryRegion as string,
    emailRestriction: {
      enabled: emailRestriction.enabled as boolean,
      ...(emailRestriction.enabled && {
        allowedDomains: emailRestriction.allowedDomains as string[],
      }),
    },
    mfa: config.mfa as 'required' | 'optional' | 'off',
  };

  if (config.customDomain !== null && config.customDomain !== undefined) {
    const cd = config.customDomain as Record<string, unknown>;
    validated.customDomain = {
      domainName: cd.domainName as string,
      certificateArn: cd.certificateArn as string,
    };
  }

  return validated;
}
