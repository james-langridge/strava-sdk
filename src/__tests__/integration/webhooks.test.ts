import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { StravaWebhooks } from '../../core/webhooks';
import type { WebhookEvent } from '../../types';

describe('StravaWebhooks Integration', () => {
  let webhooks: StravaWebhooks;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn();

    webhooks = new StravaWebhooks({
      clientId: 'test-client-id',
      clientSecret: 'test-secret',
      verifyToken: 'test-verify-token',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('viewSubscription', () => {
    it('returns subscription when one exists', async () => {
      const mockSubscription = {
        id: 123,
        callback_url: 'https://example.com/webhook',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [mockSubscription],
      });

      const result = await webhooks.viewSubscription();

      expect(result).toEqual(mockSubscription);
    });

    it('returns null when no subscription exists', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const result = await webhooks.viewSubscription();

      expect(result).toBe(null);
    });

    it('throws error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid credentials',
      });

      await expect(webhooks.viewSubscription()).rejects.toThrow(
        'Failed to view subscription',
      );
    });
  });

  describe('createSubscription', () => {
    it('creates subscription successfully', async () => {
      // First call: viewSubscription returns null
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      const mockSubscription = {
        id: 123,
        callback_url: 'https://example.com/webhook',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      // Second call: createSubscription succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockSubscription,
      });

      const result = await webhooks.createSubscription(
        'https://example.com/webhook',
      );

      expect(result).toEqual(mockSubscription);
    });

    it('throws error if subscription already exists', async () => {
      const existingSubscription = {
        id: 123,
        callback_url: 'https://example.com/existing',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [existingSubscription],
      });

      await expect(
        webhooks.createSubscription('https://example.com/webhook'),
      ).rejects.toThrow('Subscription already exists');
    });

    it('throws error for non-HTTPS callback URL', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      await expect(
        webhooks.createSubscription('http://example.com/webhook'),
      ).rejects.toThrow('Callback URL must use HTTPS protocol');
    });

    it('throws error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [],
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid callback URL',
      });

      await expect(
        webhooks.createSubscription('https://example.com/webhook'),
      ).rejects.toThrow('Failed to create subscription');
    });
  });

  describe('deleteSubscription', () => {
    it('deletes subscription successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        status: 204,
      });

      await expect(webhooks.deleteSubscription(123)).resolves.toBeUndefined();
    });

    it('throws error on API failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Subscription not found',
      });

      await expect(webhooks.deleteSubscription(999)).rejects.toThrow(
        'Failed to delete subscription',
      );
    });
  });

  describe('event handlers', () => {
    it('invokes activity create handler', async () => {
      const handler = vi.fn();
      webhooks.onActivityCreate(handler);

      const event: WebhookEvent = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'create',
        owner_id: 67890,
        subscription_id: 123,
        event_time: 1234567890,
      };

      await webhooks.processEvent(event);

      expect(handler).toHaveBeenCalledWith(event, 67890);
    });

    it('invokes activity update handler', async () => {
      const handler = vi.fn();
      webhooks.onActivityUpdate(handler);

      const event: WebhookEvent = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'update',
        owner_id: 67890,
        subscription_id: 123,
        event_time: 1234567890,
        updates: { title: 'Updated title' },
      };

      await webhooks.processEvent(event);

      expect(handler).toHaveBeenCalledWith(event, 67890);
    });

    it('invokes activity delete handler', async () => {
      const handler = vi.fn();
      webhooks.onActivityDelete(handler);

      const event: WebhookEvent = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'delete',
        owner_id: 67890,
        subscription_id: 123,
        event_time: 1234567890,
      };

      await webhooks.processEvent(event);

      expect(handler).toHaveBeenCalledWith(event, 67890);
    });

    it('invokes deauthorize handler', async () => {
      const handler = vi.fn();
      webhooks.onAthleteDeauthorize(handler);

      const event: WebhookEvent = {
        object_type: 'athlete',
        object_id: 67890,
        aspect_type: 'deauthorize',
        owner_id: 67890,
        subscription_id: 123,
        event_time: 1234567890,
      };

      await webhooks.processEvent(event);

      expect(handler).toHaveBeenCalledWith(event, 67890);
    });

    it('invokes multiple handlers for same event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      webhooks.onActivityCreate(handler1);
      webhooks.onActivityCreate(handler2);

      const event: WebhookEvent = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'create',
        owner_id: 67890,
        subscription_id: 123,
        event_time: 1234567890,
      };

      await webhooks.processEvent(event);

      expect(handler1).toHaveBeenCalledWith(event, 67890);
      expect(handler2).toHaveBeenCalledWith(event, 67890);
    });

    it('does not invoke handlers for different event types', async () => {
      const createHandler = vi.fn();
      const updateHandler = vi.fn();

      webhooks.onActivityCreate(createHandler);
      webhooks.onActivityUpdate(updateHandler);

      const event: WebhookEvent = {
        object_type: 'activity',
        object_id: 12345,
        aspect_type: 'create',
        owner_id: 67890,
        subscription_id: 123,
        event_time: 1234567890,
      };

      await webhooks.processEvent(event);

      expect(createHandler).toHaveBeenCalled();
      expect(updateHandler).not.toHaveBeenCalled();
    });
  });
});