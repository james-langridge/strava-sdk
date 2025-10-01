/**
 * Webhook data types
 */

/**
 * Webhook subscription from Strava
 */
export interface WebhookSubscription {
  readonly id: number;
  readonly callback_url: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Strava webhook event
 */
export interface WebhookEvent {
  readonly object_type: "activity" | "athlete";
  readonly object_id: number;
  readonly aspect_type: "create" | "update" | "delete" | "deauthorize";
  readonly owner_id: number;
  readonly subscription_id: number;
  readonly event_time: number;
  readonly updates?: Record<string, any>;
}

/**
 * Webhook verification parameters from Strava
 */
export interface WebhookVerificationParams {
  readonly "hub.mode"?: string;
  readonly "hub.verify_token"?: string;
  readonly "hub.challenge"?: string;
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  readonly "hub.challenge": string;
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  readonly verifyToken: string;
  readonly callbackUrl?: string;
}

/**
 * Webhook event handlers
 */
export type ActivityCreateHandler = (
  event: WebhookEvent,
  athleteId: number,
) => void | Promise<void>;

export type ActivityUpdateHandler = (
  event: WebhookEvent,
  athleteId: number,
) => void | Promise<void>;

export type ActivityDeleteHandler = (
  event: WebhookEvent,
  athleteId: number,
) => void | Promise<void>;

export type DeauthorizeHandler = (
  event: WebhookEvent,
  athleteId: number,
) => void | Promise<void>;
