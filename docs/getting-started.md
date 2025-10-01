# Getting Started with Strava SDK

This guide will help you integrate Strava authentication and API calls into your application in under 15 minutes.

## Installation

```bash
npm install strava-sdk
```

## Prerequisites

1. **Strava API Credentials**
   - Go to https://www.strava.com/settings/api
   - Create a new application
   - Note your Client ID and Client Secret
   - Set your Authorization Callback Domain

2. **Node.js Version**
   - Node 18 or higher (for native fetch support)

## Quick Start

### Step 1: Initialize the Client

```typescript
import { StravaClient, MemoryStorage } from 'strava-sdk';

const strava = new StravaClient({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/callback',
  storage: new MemoryStorage(), // Use your own storage implementation for production
});
```

### Step 2: Implement OAuth Flow

```typescript
import express from 'express';

const app = express();

// Redirect user to Strava authorization
app.get('/auth/strava', (req, res) => {
  const authUrl = strava.oauth.getAuthUrl({
    scopes: ['activity:read_all', 'activity:write'],
    state: 'optional-csrf-token',
  });
  res.redirect(authUrl);
});

// Handle OAuth callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const tokens = await strava.oauth.exchangeCode(code as string);

    // Save tokens using your storage implementation
    await strava.storage.saveTokens(tokens.athlete.id.toString(), {
      athleteId: tokens.athlete.id.toString(),
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expires_at * 1000),
    });

    res.send(`Welcome, ${tokens.athlete.firstname}!`);
  } catch (error) {
    res.status(500).send('Authentication failed');
  }
});
```

### Step 3: Make API Calls

```typescript
// Fetch an activity
app.get('/activity/:id', async (req, res) => {
  const { id } = req.params;
  const athleteId = req.session.athleteId; // From your session management

  try {
    // This automatically refreshes tokens if needed
    const activity = await strava.getActivityWithRefresh(id, athleteId);
    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an activity
app.patch('/activity/:id', async (req, res) => {
  const { id } = req.params;
  const athleteId = req.session.athleteId;

  const activity = await strava.updateActivityWithRefresh(id, athleteId, {
    description: 'Updated via API!',
  });

  res.json(activity);
});
```

### Step 4: Set Up Webhooks (Optional)

```typescript
import { createExpressHandlers } from 'strava-sdk';

const handlers = createExpressHandlers(strava, 'your-verify-token');

// Webhook verification endpoint (GET)
app.get('/api/webhook', handlers.webhooks.verify());

// Webhook events endpoint (POST)
app.post('/api/webhook', handlers.webhooks.events());

// Handle webhook events
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  console.log(`New activity: ${event.object_id}`);

  const tokens = await strava.storage.getTokens(athleteId.toString());
  if (tokens) {
    const activity = await strava.api.getActivity(
      event.object_id.toString(),
      tokens.accessToken,
    );
    // Process the activity...
  }
});

strava.webhooks.onAthleteDeauthorize(async (event, athleteId) => {
  console.log(`Athlete ${athleteId} deauthorized`);
  await strava.storage.deleteTokens(athleteId.toString());
});
```

## Implementing Token Storage

For production, implement the `TokenStorage` interface with your database:

```typescript
import { TokenStorage, StoredTokens } from 'strava-sdk';
import { Pool } from 'pg'; // Example with PostgreSQL

class PostgresTokenStorage implements TokenStorage {
  constructor(private pool: Pool) {}

  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    const result = await this.pool.query(
      'SELECT * FROM strava_tokens WHERE athlete_id = $1',
      [athleteId],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      athleteId: row.athlete_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at,
    };
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    await this.pool.query(
      `INSERT INTO strava_tokens (athlete_id, access_token, refresh_token, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (athlete_id)
       DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         expires_at = EXCLUDED.expires_at`,
      [athleteId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt],
    );
  }

  async deleteTokens(athleteId: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM strava_tokens WHERE athlete_id = $1',
      [athleteId],
    );
  }
}

// Use it
const strava = new StravaClient({
  // ...other config
  storage: new PostgresTokenStorage(pool),
});
```

## Next Steps

- [API Reference](./api-reference.md) - Complete API documentation
- [Webhook Guide](./webhooks.md) - Detailed webhook setup
- [Storage Guide](./storage.md) - Storage implementation examples
- [Examples](../examples/) - Complete example applications

## Common Patterns

### Rate Limit Monitoring

```typescript
const strava = new StravaClient({
  // ...config
  onRateLimit: (info) => {
    console.log(`Rate limit: ${info.used15Min}/${info.limit15Min} (15min)`);
    console.log(`Rate limit: ${info.usedDaily}/${info.limitDaily} (daily)`);
  },
});
```

### Error Handling

```typescript
import { classifyError } from 'strava-sdk';

try {
  const activity = await strava.api.getActivity(id, token);
} catch (error) {
  const classified = classifyError(error);

  if (classified.isRetryable) {
    // Retry the request
  } else if (classified.errorCode === 'UNAUTHORIZED') {
    // Refresh token or re-authenticate
  } else {
    // Handle other errors
  }
}
```

### Custom Logging

```typescript
const strava = new StravaClient({
  // ...config
  logger: {
    debug: (msg, meta) => logger.debug(msg, meta),
    info: (msg, meta) => logger.info(msg, meta),
    warn: (msg, meta) => logger.warn(msg, meta),
    error: (msg, meta) => logger.error(msg, meta),
  },
});
```