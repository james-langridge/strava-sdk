/**
 * Express integration for Strava SDK
 *
 * Provides Express middleware for OAuth and webhook handling.
 */

import type { Request, Response, RequestHandler } from "express";
import type { StravaClient } from "../core/client";
import type { WebhookEvent, WebhookVerificationParams } from "../types";
import { validateWebhookVerification } from "../utils";

/**
 * OAuth callback options
 */
export interface OAuthCallbackOptions {
  readonly onSuccess: (
    req: Request,
    res: Response,
    tokens: Awaited<ReturnType<StravaClient["oauth"]["exchangeCode"]>>,
  ) => void | Promise<void>;
  readonly onError: (
    req: Request,
    res: Response,
    error: Error,
  ) => void | Promise<void>;
}

/**
 * Create Express OAuth handlers
 */
export function createOAuthHandlers(client: StravaClient) {
  return {
    /**
     * GET handler to redirect to Strava authorization
     */
    authorize: (options?: {
      scopes?: string[];
      state?: string;
    }): RequestHandler => {
      return (_req: Request, res: Response) => {
        const authUrl = client.oauth.getAuthUrl({
          scopes: options?.scopes,
          state: options?.state,
        });
        res.redirect(authUrl);
      };
    },

    /**
     * GET handler for OAuth callback
     */
    callback: (options: OAuthCallbackOptions): RequestHandler => {
      return async (req: Request, res: Response) => {
        try {
          const { code, error } = req.query;

          if (error) {
            const err = new Error(`OAuth error: ${error}`);
            await options.onError(req, res, err);
            return;
          }

          if (!code || typeof code !== "string") {
            const err = new Error("Missing authorization code");
            await options.onError(req, res, err);
            return;
          }

          const tokens = await client.oauth.exchangeCode(code);
          await options.onSuccess(req, res, tokens);
        } catch (error) {
          await options.onError(
            req,
            res,
            error instanceof Error ? error : new Error("Unknown error"),
          );
        }
      };
    },
  };
}

/**
 * Webhook handler options
 */
export interface WebhookHandlerOptions {
  readonly verifyToken: string;
}

/**
 * Create Express webhook handlers
 */
export function createWebhookHandlers(
  client: StravaClient,
  options: WebhookHandlerOptions,
) {
  return {
    /**
     * GET handler for webhook verification
     */
    verify: (): RequestHandler => {
      return (req: Request, res: Response) => {
        const params: WebhookVerificationParams = {
          "hub.mode": req.query["hub.mode"] as string | undefined,
          "hub.verify_token": req.query["hub.verify_token"] as
            | string
            | undefined,
          "hub.challenge": req.query["hub.challenge"] as string | undefined,
        };

        const result = validateWebhookVerification(
          {
            mode: params["hub.mode"],
            token: params["hub.verify_token"],
            challenge: params["hub.challenge"],
          },
          options.verifyToken,
        );

        if (!result.valid) {
          res.status(403).json({ error: result.reason });
          return;
        }

        res.json({ "hub.challenge": result.challenge });
      };
    },

    /**
     * POST handler for webhook events
     */
    events: (): RequestHandler => {
      return async (req: Request, res: Response) => {
        try {
          const event = req.body as WebhookEvent;

          res.status(200).json({ success: true });

          await client.webhooks.processEvent(event);
        } catch (error) {
          console.error("Webhook processing error:", error);
        }
      };
    },
  };
}

/**
 * Create all Express handlers for OAuth and webhooks
 */
export function createExpressHandlers(
  client: StravaClient,
  webhookVerifyToken: string,
) {
  return {
    oauth: createOAuthHandlers(client),
    webhooks: createWebhookHandlers(client, {
      verifyToken: webhookVerifyToken,
    }),
  };
}
