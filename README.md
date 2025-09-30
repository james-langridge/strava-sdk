# Strava SDK

Production-ready TypeScript SDK for Strava API with OAuth, webhooks, and rate limiting.

## Features

- **Complete OAuth Flow**: Authorization URL generation and token exchange
- **Rate Limiting**: Built-in Bottleneck integration respecting Strava's limits (200/15min, 2000/day)
- **Token Management**: Automatic token refresh with configurable expiry buffer
- **Webhook Support**: Full webhook subscription management and event handling
- **Type-Safe**: Full TypeScript support with comprehensive type definitions
- **Storage Agnostic**: Bring your own database via simple interface
- **Framework Integrations**: Express middleware (more frameworks coming soon)
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

// Get activity
const activity = await strava.api.getActivity('12345', tokens.access_token);

// Update activity
await strava.api.updateActivity('12345', tokens.access_token, {
  description: 'Amazing ride!',
});
```

## Documentation

- [Getting Started Guide](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Webhook Setup](./docs/webhooks.md)
- [Storage Implementation](./docs/storage.md)

## Requirements

- Node.js 18 or higher
- TypeScript 5.0 or higher (for TypeScript projects)

## License

MIT