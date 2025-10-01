# Strava SDK

TypeScript SDK for Strava API with OAuth, webhooks, and rate limiting.

## Features

- **Complete OAuth Flow**: Authorization URL generation and token exchange
- **Rate Limiting**: Built-in Bottleneck integration respecting Strava's limits (200/15min, 2000/day)
- **Token Management**: Automatic token refresh with configurable expiry buffer
- **Webhook Support**: Full webhook subscription management and event handling
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Storage Agnostic**: Bring your own database via simple interface
- **Framework Integrations**: Express middleware 
- **Error Handling**: Detailed error classification and retry logic

## Installation

```bash
npm install strava-sdk
```

## Quick Start

```typescript
import { StravaClient, MemoryStorage } from 'strava-sdk';

const strava = new StravaClient({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: 'http://localhost:3000/auth/callback',
  storage: new MemoryStorage(), // Use your own storage implementation
});

// Generate OAuth URL
const authUrl = strava.oauth.getAuthUrl({
  scopes: ['activity:read_all', 'activity:write'],
});

// Exchange code for tokens
const tokens = await strava.oauth.exchangeCode(code);

// Save tokens
await strava.storage.saveTokens(tokens.athlete.id.toString(), {
  athleteId: tokens.athlete.id.toString(),
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: new Date(tokens.expires_at * 1000),
});

// Get activity (with automatic token refresh)
const activity = await strava.getActivityWithRefresh('12345', athleteId);

// Update activity
await strava.updateActivityWithRefresh('12345', athleteId, {
  description: 'Amazing ride!',
});
```

## Express Integration

```typescript
import express from 'express';
import { createExpressHandlers } from 'strava-sdk';

const app = express();
const handlers = createExpressHandlers(strava, 'webhook-verify-token');

// OAuth routes
app.get('/auth/strava', handlers.oauth.authorize());
app.get('/auth/callback', handlers.oauth.callback({
  onSuccess: async (req, res, tokens) => {
    // Save tokens and redirect
    res.redirect('/dashboard');
  },
  onError: (req, res, error) => {
    res.status(500).send('Auth failed');
  },
}));

// Webhook routes
app.get('/api/webhook', handlers.webhooks.verify());
app.post('/api/webhook', handlers.webhooks.events());

// Handle webhook events
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  console.log(`New activity: ${event.object_id}`);
});
```

## Webhook Events

```typescript
strava.webhooks.onActivityCreate(async (event, athleteId) => {
  // Handle new activity
});

strava.webhooks.onActivityUpdate(async (event, athleteId) => {
  // Handle activity update
});

strava.webhooks.onActivityDelete(async (event, athleteId) => {
  // Handle activity deletion
});

strava.webhooks.onAthleteDeauthorize(async (event, athleteId) => {
  // Clean up athlete data
  await strava.storage.deleteTokens(athleteId.toString());
});
```

## Implementing Storage

For production, implement `TokenStorage` with your database:

```typescript
import { TokenStorage, StoredTokens } from 'strava-sdk';

class YourDatabaseStorage implements TokenStorage {
  async getTokens(athleteId: string): Promise<StoredTokens | null> {
    // Fetch from your database
  }

  async saveTokens(athleteId: string, tokens: StoredTokens): Promise<void> {
    // Save to your database
  }

  async deleteTokens(athleteId: string): Promise<void> {
    // Delete from your database
  }
}
```

See [Storage Guide](./docs/storage.md) for complete examples with PostgreSQL, MongoDB, and Redis.

## Documentation

- **[Getting Started Guide](./docs/getting-started.md)** - Complete setup walkthrough
- **[Examples](./examples/)** - Working example applications
- [API Reference](./docs/api-reference.md) - Detailed API documentation
- [Webhook Setup](./docs/webhooks.md) - Webhook configuration guide
- [Storage Implementation](./docs/storage.md) - Database integration examples

## Examples

Check out the [examples](./examples/) directory for complete applications:

- **[basic-app](./examples/basic-app/)** - Minimal Express app with OAuth and webhooks

## Requirements

- Node.js 18 or higher
- TypeScript 5.0 or higher (for TypeScript projects)

## Contributing

Contributions are welcome! Please open an issue or pull request.

## License

MIT
