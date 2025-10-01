/**
 * Input validation utilities
 */

/**
 * Validate webhook verification parameters
 */
export interface WebhookVerificationInput {
  readonly mode?: string;
  readonly token?: string;
  readonly challenge?: string;
}

export function validateWebhookVerification(
  params: WebhookVerificationInput,
  expectedToken: string,
): {
  readonly valid: boolean;
  readonly reason?: string;
  readonly challenge?: string;
} {
  if (!params.mode || !params.token || !params.challenge) {
    return {
      valid: false,
      reason: "Missing required verification parameters",
    };
  }

  if (params.mode !== "subscribe") {
    return {
      valid: false,
      reason: `Invalid verification mode: ${params.mode}`,
    };
  }

  if (params.token !== expectedToken) {
    return {
      valid: false,
      reason: "Invalid verification token",
    };
  }

  return {
    valid: true,
    challenge: params.challenge,
  };
}

/**
 * Validate OAuth configuration
 */
export function validateOAuthConfig(config: {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}): string[] {
  const errors: string[] = [];

  if (!config.clientId) {
    errors.push("clientId is required");
  }
  if (!config.clientSecret) {
    errors.push("clientSecret is required");
  }
  if (!config.redirectUri) {
    errors.push("redirectUri is required");
  }

  return errors;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate HTTPS URL
 */
export function isHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
