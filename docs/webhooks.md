# Webhook Setup Guide

Learn how to set up and handle Strava webhook events in your application.

## Overview

Strava webhooks allow your application to receive real-time notifications when:
- Athletes create new activities
- Athletes update existing activities
- Athletes delete activities
- Athletes deauthorize your application

## Prerequisites

- A publicly accessible HTTPS endpoint (required for production)
- Your Strava API credentials
- A verify token (any string you choose)

**Note:** Strava requires HTTPS for webhook endpoints in production. For local development, use tools like ngrok to create a public HTTPS URL.

## Quick Start

### 1. Set Up Webhook Handlers

```typescript
import { StravaClient, MemoryStorage } from "strava-sdk";

const strava = new StravaClient({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: "https://yourdomain.com/auth/callback",
  storage: new MemoryStorage(),
});

// Handle new activities
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  console.log(`Athlete ${athleteId} created activity ${event.object_id}`);

  // Fetch full activity details if needed
  const activity = await strava.getActivityWithRefresh(
    event.object_id.toString(),
    athleteId.toString()
  );

  // Process the activity...
  console.log(`Activity: ${activity.name}`);
});

// Handle activity updates
strava.webhooks.onActivityUpdate(async (event, athleteId) => {
  console.log(`Activity ${event.object_id} was updated`);
  console.log('Changed fields:', event.updates);
});

// Handle activity deletions
strava.webhooks.onActivityDelete(async (event, athleteId) => {
  console.log(`Activity ${event.object_id} was deleted`);
  // Clean up any stored data for this activity
});

// Handle athlete deauthorization
strava.webhooks.onAthleteDeauthorize(async (event, athleteId) => {
  console.log(`Athlete ${athleteId} deauthorized the app`);

  // IMPORTANT: Clean up athlete data
  await strava.storage.deleteTokens(athleteId.toString());
  // Delete other athlete data from your database
});
```

### 2. Set Up Express Routes

```typescript
import express from "express";
import { createExpressHandlers } from "strava-sdk";

const app = express();
const WEBHOOK_VERIFY_TOKEN = "your-secret-verify-token";
const handlers = createExpressHandlers(strava, WEBHOOK_VERIFY_TOKEN);

// Webhook verification endpoint (GET)
// Strava calls this to verify your endpoint when subscribing
app.get("/api/webhook", handlers.webhooks.verify());

// Webhook events endpoint (POST)
// Strava calls this to deliver event notifications
app.post("/api/webhook", handlers.webhooks.events());

app.listen(3000);
```

### 3. Create Webhook Subscription

You only need to do this once (or when your callback URL changes):

```typescript
const subscription = await strava.webhooks.createSubscription({
  callbackUrl: "https://yourdomain.com/api/webhook",
  verifyToken: WEBHOOK_VERIFY_TOKEN,
});

console.log(`Subscription created: ${subscription.id}`);
```

**Important:** Store the subscription ID if you need to delete it later.

## Webhook Event Flow

1. **Athlete performs action** (creates/updates/deletes activity, deauthorizes app)
2. **Strava sends POST request** to your webhook endpoint
3. **Your endpoint responds with 200 OK** immediately (required within 2 seconds)
4. **SDK processes event asynchronously** and calls your registered handlers
5. **Your handlers execute** (fetch activity details, update database, etc.)

## Event Types

### Activity Create

Fired when an athlete uploads or creates a new activity.

```typescript
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  // event.object_id is the activity ID
  // event.owner_id is the athlete ID (same as athleteId parameter)

  const activity = await strava.getActivityWithRefresh(
    event.object_id.toString(),
    athleteId.toString()
  );

  // Example: Send congratulations email
  // Example: Update leaderboards
  // Example: Trigger data processing pipeline
});
```

### Activity Update

Fired when an athlete modifies an existing activity.

```typescript
strava.webhooks.onActivityUpdate(async (event, athleteId) => {
  // event.updates contains the fields that changed
  console.log('Updated fields:', event.updates);

  // Common updates:
  // - title: Activity name changed
  // - type: Activity type changed
  // - private: Privacy setting changed

  // Fetch updated activity if needed
  const activity = await strava.getActivityWithRefresh(
    event.object_id.toString(),
    athleteId.toString()
  );
});
```

### Activity Delete

Fired when an athlete deletes an activity.

```typescript
strava.webhooks.onActivityDelete(async (event, athleteId) => {
  // event.object_id is the deleted activity ID

  // Clean up stored data
  await db.activities.delete({ id: event.object_id });

  // Note: You cannot fetch the activity details - it's already deleted
});
```

### Athlete Deauthorize

Fired when an athlete deauthorizes your application.

```typescript
strava.webhooks.onAthleteDeauthorize(async (event, athleteId) => {
  // REQUIRED: Delete athlete tokens
  await strava.storage.deleteTokens(athleteId.toString());

  // RECOMMENDED: Delete all athlete data per GDPR/privacy laws
  await db.athletes.delete({ id: athleteId });
  await db.activities.deleteMany({ athleteId });

  // Optional: Send farewell email
});
```

## Managing Subscriptions

### List Active Subscriptions

```typescript
const subscriptions = await strava.webhooks.listSubscriptions();
subscriptions.forEach(sub => {
  console.log(`ID: ${sub.id}, URL: ${sub.callback_url}`);
});
```

### Delete Subscription

```typescript
await strava.webhooks.deleteSubscription(subscriptionId);
console.log('Subscription deleted');
```

**Note:** You can only have one active webhook subscription per application.

## Local Development

### Using ngrok

1. Install ngrok: `npm install -g ngrok`
2. Start your local server: `npm start`
3. Create ngrok tunnel: `ngrok http 3000`
4. Use the HTTPS URL for your webhook callback:
   ```typescript
   const subscription = await strava.webhooks.createSubscription({
     callbackUrl: "https://abc123.ngrok.io/api/webhook",
     verifyToken: "dev-verify-token",
   });
   ```

### Testing Webhooks

Strava doesn't provide a webhook testing UI, but you can:

1. **Perform real actions** in the Strava app/website
2. **Monitor your server logs** for incoming webhook events
3. **Use request logging middleware**:
   ```typescript
   app.use((req, res, next) => {
     console.log(`${req.method} ${req.path}`, req.body);
     next();
   });
   ```

## Production Considerations

### 1. HTTPS Required

Strava requires HTTPS for webhook callbacks. Use a proper SSL certificate (Let's Encrypt is free).

### 2. Fast Response Required

Your endpoint must respond with 200 OK within 2 seconds or Strava will retry.

```typescript
// BAD: Slow processing blocks response
app.post("/webhook", async (req, res) => {
  await processActivitySlowly(req.body); // Takes 10 seconds
  res.sendStatus(200); // TOO LATE
});

// GOOD: Respond immediately, process asynchronously
app.post("/webhook", handlers.webhooks.events());
// SDK handles async processing automatically
```

### 3. Idempotency

Strava may send duplicate events. Make your handlers idempotent:

```typescript
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  // Use upsert to handle duplicates
  await db.activities.upsert({
    where: { id: event.object_id },
    create: { id: event.object_id, athleteId, /* ... */ },
    update: { updatedAt: new Date() }
  });
});
```

### 4. Error Handling

Errors in your handlers won't affect the webhook response:

```typescript
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  try {
    const activity = await strava.getActivityWithRefresh(
      event.object_id.toString(),
      athleteId.toString()
    );
    await processActivity(activity);
  } catch (error) {
    console.error('Failed to process activity:', error);
    // Consider adding to retry queue
  }
});
```

### 5. Rate Limiting

Webhook events don't count against your API rate limit, but fetching activity details does. The SDK handles rate limiting automatically.

### 6. Monitoring

Log webhook events for debugging:

```typescript
const strava = new StravaClient({
  // ...config
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }
});
```

## Common Patterns

### Fetch Activity Details

```typescript
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  const activity = await strava.getActivityWithRefresh(
    event.object_id.toString(),
    athleteId.toString()
  );

  // Now you have full activity details
  console.log(`${activity.name}: ${activity.distance}m in ${activity.moving_time}s`);
});
```

### Update Activity Automatically

```typescript
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  // Auto-tag morning rides
  const activity = await strava.getActivityWithRefresh(
    event.object_id.toString(),
    athleteId.toString()
  );

  const hour = new Date(activity.start_date).getHours();
  if (hour >= 5 && hour < 9) {
    await strava.updateActivityWithRefresh(
      event.object_id.toString(),
      athleteId.toString(),
      { description: "🌅 Morning ride!" }
    );
  }
});
```

### Conditional Processing

```typescript
strava.webhooks.onActivityUpdate(async (event, athleteId) => {
  // Only process if title changed
  if (event.updates?.title) {
    console.log(`Activity ${event.object_id} renamed to: ${event.updates.title}`);
  }
});
```

### Background Processing

```typescript
import { Queue } from 'bull'; // or any job queue

const activityQueue = new Queue('activities');

strava.webhooks.onActivityCreate(async (event, athleteId) => {
  // Queue activity for processing
  await activityQueue.add({
    activityId: event.object_id,
    athleteId: athleteId.toString()
  });
});

// Process activities in the background
activityQueue.process(async (job) => {
  const { activityId, athleteId } = job.data;
  const activity = await strava.getActivityWithRefresh(activityId, athleteId);
  // Heavy processing here
});
```

## Troubleshooting

### Webhook Not Receiving Events

1. **Check callback URL** - Must be publicly accessible HTTPS
2. **Verify subscription** - Run `listSubscriptions()` to confirm it exists
3. **Check server logs** - Ensure your endpoint is responding with 200 OK
4. **Test manually** - Create an activity in Strava and watch logs

### Subscription Creation Fails

1. **Verify verify token** - Must match between creation and GET endpoint
2. **Check HTTPS** - Strava requires valid SSL certificate
3. **Test GET endpoint** - Call it manually with the challenge parameter:
   ```
   GET /api/webhook?hub.mode=subscribe&hub.challenge=test&hub.verify_token=your-token
   ```

### Events Not Processing

1. **Check handler registration** - Ensure `onActivityCreate()` etc. are called before events arrive
2. **Check for errors** - Add try-catch in handlers and log errors
3. **Verify tokens** - Ensure athlete tokens are valid

## Security

### Verify Token

The verify token prevents unauthorized webhook creation:

```typescript
// Use a secure random string
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
```

### Request Validation

The SDK automatically validates that webhook requests come from Strava by checking the verify token during the challenge handshake.

For additional security, you can verify the request source:

```typescript
app.post("/webhook", (req, res, next) => {
  // Optional: Check IP address
  // Strava webhooks come from specific IP ranges

  // Optional: Add authentication
  // const token = req.headers['x-webhook-auth'];
  // if (token !== process.env.WEBHOOK_SECRET) {
  //   return res.sendStatus(401);
  // }

  next();
}, handlers.webhooks.events());
```

## Rate Limits

- **Webhook event delivery**: Not rate limited
- **API calls from handlers**: Subject to normal API rate limits (200/15min, 2000/day)
- The SDK automatically queues and rate-limits API calls

## Best Practices

1. **Respond quickly** - Return 200 OK immediately
2. **Process asynchronously** - Use job queues for heavy processing
3. **Handle duplicates** - Make handlers idempotent
4. **Clean up on deauthorize** - Delete athlete data
5. **Monitor and log** - Track webhook delivery and processing
6. **Use HTTPS** - Required by Strava in production
7. **Test thoroughly** - Perform real actions in Strava to trigger webhooks

## Next Steps

- [API Reference](./api-reference.md) - Detailed API documentation
- [Storage Guide](./storage.md) - Implement token storage
- [Examples](../examples/) - See complete working examples
