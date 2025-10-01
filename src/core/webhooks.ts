/**
 * Webhook management module
 *
 * Handles Strava webhook subscription management and event processing.
 */

import type {
  WebhookSubscription,
  WebhookEvent,
  ActivityCreateHandler,
  ActivityUpdateHandler,
  ActivityDeleteHandler,
  DeauthorizeHandler,
  Logger,
} from "../types";
import { isHttpsUrl } from "../utils";

export interface WebhookManagerConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly verifyToken: string;
  readonly logger?: Logger;
}

const STRAVA_WEBHOOK_URL = "https://www.strava.com/api/v3/push_subscriptions";

export class StravaWebhooks {
  private readonly config: WebhookManagerConfig;
  private readonly logger?: Logger;
  private readonly handlers: {
    activityCreate: ActivityCreateHandler[];
    activityUpdate: ActivityUpdateHandler[];
    activityDelete: ActivityDeleteHandler[];
    deauthorize: DeauthorizeHandler[];
  } = {
    activityCreate: [],
    activityUpdate: [],
    activityDelete: [],
    deauthorize: [],
  };

  constructor(config: WebhookManagerConfig) {
    this.config = config;
    this.logger = config.logger;
  }

  /**
   * View current webhook subscription
   */
  async viewSubscription(): Promise<WebhookSubscription | null> {
    this.logger?.debug("Checking for existing webhook subscription");

    try {
      const url = new URL(STRAVA_WEBHOOK_URL);
      url.searchParams.set("client_id", this.config.clientId);
      url.searchParams.set("client_secret", this.config.clientSecret);

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error("Failed to retrieve webhook subscription", {
          status: response.status,
          error: errorText,
        });
        throw new Error(
          `Failed to view subscription: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const subscription = data[0] as WebhookSubscription;
        this.logger?.info("Found existing webhook subscription", {
          subscriptionId: subscription.id,
        });
        return subscription;
      }

      this.logger?.debug("No existing webhook subscription found");
      return null;
    } catch (error) {
      this.logger?.error("Error retrieving webhook subscription", { error });
      throw error;
    }
  }

  /**
   * Create a new webhook subscription
   */
  async createSubscription(callbackUrl: string): Promise<WebhookSubscription> {
    this.logger?.info("Creating webhook subscription", { callbackUrl });

    try {
      const existing = await this.viewSubscription();
      if (existing) {
        throw new Error(
          "Subscription already exists. Delete existing subscription first.",
        );
      }

      if (!isHttpsUrl(callbackUrl)) {
        throw new Error("Callback URL must use HTTPS protocol");
      }

      const formData = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        callback_url: callbackUrl,
        verify_token: this.config.verifyToken,
      });

      const response = await fetch(STRAVA_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error("Failed to create webhook subscription", {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to create subscription: ${errorText}`);
      }

      const subscription = (await response.json()) as WebhookSubscription;
      this.logger?.info("Webhook subscription created successfully", {
        subscriptionId: subscription.id,
      });

      return subscription;
    } catch (error) {
      this.logger?.error("Error creating webhook subscription", { error });
      throw error;
    }
  }

  /**
   * Delete a webhook subscription
   */
  async deleteSubscription(subscriptionId: number): Promise<void> {
    this.logger?.info("Deleting webhook subscription", { subscriptionId });

    try {
      const url = `${STRAVA_WEBHOOK_URL}/${subscriptionId}`;
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch(`${url}?${params}`, {
        method: "DELETE",
      });

      if (response.status === 204) {
        this.logger?.info("Webhook subscription deleted successfully", {
          subscriptionId,
        });
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        this.logger?.error("Failed to delete webhook subscription", {
          subscriptionId,
          status: response.status,
          error: errorText,
        });
        throw new Error(
          `Failed to delete subscription: ${response.statusText}`,
        );
      }
    } catch (error) {
      this.logger?.error("Error deleting webhook subscription", { error });
      throw error;
    }
  }

  /**
   * Register handler for activity create events
   */
  onActivityCreate(handler: ActivityCreateHandler): void {
    this.handlers.activityCreate.push(handler);
  }

  /**
   * Register handler for activity update events
   */
  onActivityUpdate(handler: ActivityUpdateHandler): void {
    this.handlers.activityUpdate.push(handler);
  }

  /**
   * Register handler for activity delete events
   */
  onActivityDelete(handler: ActivityDeleteHandler): void {
    this.handlers.activityDelete.push(handler);
  }

  /**
   * Register handler for athlete deauthorization events
   */
  onAthleteDeauthorize(handler: DeauthorizeHandler): void {
    this.handlers.deauthorize.push(handler);
  }

  /**
   * Process incoming webhook event
   */
  async processEvent(event: WebhookEvent): Promise<void> {
    this.logger?.debug("Processing webhook event", {
      objectType: event.object_type,
      aspectType: event.aspect_type,
      objectId: event.object_id,
    });

    try {
      if (event.object_type === "activity") {
        if (event.aspect_type === "create") {
          await this.invokeHandlers(
            this.handlers.activityCreate,
            event,
            event.owner_id,
          );
        } else if (event.aspect_type === "update") {
          await this.invokeHandlers(
            this.handlers.activityUpdate,
            event,
            event.owner_id,
          );
        } else if (event.aspect_type === "delete") {
          await this.invokeHandlers(
            this.handlers.activityDelete,
            event,
            event.owner_id,
          );
        }
      } else if (
        event.object_type === "athlete" &&
        event.aspect_type === "deauthorize"
      ) {
        await this.invokeHandlers(
          this.handlers.deauthorize,
          event,
          event.owner_id,
        );
      }
    } catch (error) {
      this.logger?.error("Error processing webhook event", {
        event,
        error,
      });
      throw error;
    }
  }

  /**
   * Invoke all handlers for an event
   */
  private async invokeHandlers(
    handlers: Array<
      (event: WebhookEvent, athleteId: number) => void | Promise<void>
    >,
    event: WebhookEvent,
    athleteId: number,
  ): Promise<void> {
    await Promise.all(handlers.map((handler) => handler(event, athleteId)));
  }
}
