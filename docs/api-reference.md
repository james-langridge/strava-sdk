# API Reference

Complete API documentation for Strava SDK.

## Table of Contents

- [StravaClient](#stravaclient)
- [OAuth](#oauth)
- [API](#api)
- [Webhooks](#webhooks)
- [Storage](#storage)
- [Types](#types)
- [Utilities](#utilities)

## StravaClient

Main entry point to the SDK.

### Constructor

```typescript
new StravaClient(config: StravaClientConfig)
```

**Config Options:**

```typescript
interface StravaClientConfig {
  clientId: string;              // Strava API client ID
  clientSecret: string;          // Strava API client secret
  redirectUri: string;           // OAuth redirect URI
  storage: TokenStorage;         // Token storage implementation
  defaultScopes?: string[];      // Default OAuth scopes
  rateLimiting?: RateLimitConfig;
  retry?: RetryConfig;
  logger?: Logger;
  webhooks?: {
    verifyToken?: string;
  };
  onApiCall?: (info: ApiCallInfo) => void;
  onRateLimit?: (info: RateLimitInfo) => void;
}
```

### Properties

- **`oauth`**: `StravaOAuth` - OAuth authentication methods
- **`api`**: `StravaApi` - API client for making requests
- **`webhooks`**: `StravaWebhooks` - Webhook management
- **`storage`**: `TokenStorage` - Token storage interface

### Methods

#### `getActivityWithRefresh(activityId, athleteId)`

Get activity with automatic token refresh.

```typescript
async getActivityWithRefresh(
  activityId: string,
  athleteId: string
): Promise<StravaActivity>
```

**Example:**
```typescript
const activity = await strava.getActivityWithRefresh("12345", athleteId);
console.log(activity.name);
```

#### `updateActivityWithRefresh(activityId, athleteId, updateData)`

Update activity with automatic token refresh.

```typescript
async updateActivityWithRefresh(
  activityId: string,
  athleteId: string,
  updateData: StravaUpdateData
): Promise<StravaActivity>
```

**Example:**
```typescript
const updated = await strava.updateActivityWithRefresh("12345", athleteId, {
  name: "Epic Ride",
  description: "Amazing weather!",
  gear_id: "b12345"
});
```

## OAuth

OAuth authentication module accessed via `strava.oauth`.

### `getAuthUrl(options)`

Generate authorization URL for OAuth flow.

```typescript
getAuthUrl(options?: AuthorizationOptions): string
```

**Options:**
```typescript
interface AuthorizationOptions {
  scopes?: string[];           // OAuth scopes (default: ["activity:read_all"])
  approvalPrompt?: "auto" | "force";  // Force approval prompt
  state?: string;              // CSRF token
}
```

**Available Scopes:**
- `read` - Read public data
- `read_all` - Read private activities
- `profile:read_all` - Read profile information
- `profile:write` - Update profile
- `activity:read` - Read public activities
- `activity:read_all` - Read all activities
- `activity:write` - Create/update activities

**Example:**
```typescript
const authUrl = strava.oauth.getAuthUrl({
  scopes: ["activity:read_all", "activity:write"],
  state: "csrf-token-123"
});
```

### `exchangeCode(code)`

Exchange authorization code for tokens.

```typescript
async exchangeCode(code: string): Promise<OAuthTokenResponse>
```

**Returns:**
```typescript
interface OAuthTokenResponse {
  token_type: "Bearer";
  expires_at: number;          // Unix timestamp
  expires_in: number;          // Seconds until expiry
  refresh_token: string;
  access_token: string;
  athlete: {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    // ... other athlete fields
  };
}
```

**Example:**
```typescript
const tokens = await strava.oauth.exchangeCode(code);
await strava.storage.saveTokens(tokens.athlete.id.toString(), {
  athleteId: tokens.athlete.id.toString(),
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: new Date(tokens.expires_at * 1000)
});
```

### `revokeToken(accessToken)`

Revoke access token (user deauthorization).

```typescript
async revokeToken(accessToken: string): Promise<void>
```

## API

API client accessed via `strava.api`.

### `getActivity(activityId, accessToken)`

Get activity by ID.

```typescript
async getActivity(
  activityId: string,
  accessToken: string
): Promise<StravaActivity>
```

### `getAthleteStats(athleteId, accessToken)`

Get athlete statistics.

```typescript
async getAthleteStats(
  athleteId: string,
  accessToken: string
): Promise<ActivityStats>
```

**Returns:**
```typescript
interface ActivityStats {
  recent_ride_totals: ActivityTotal;
  recent_run_totals: ActivityTotal;
  recent_swim_totals: ActivityTotal;
  ytd_ride_totals: ActivityTotal;
  ytd_run_totals: ActivityTotal;
  ytd_swim_totals: ActivityTotal;
  all_ride_totals: ActivityTotal;
  all_run_totals: ActivityTotal;
  all_swim_totals: ActivityTotal;
}

interface ActivityTotal {
  count: number;
  distance: number;            // Meters
  moving_time: number;         // Seconds
  elapsed_time: number;        // Seconds
  elevation_gain: number;      // Meters
}
```

### `getActivityStreams(activityId, accessToken, streamKeys?)`

Get activity streams (GPS data, heart rate, etc.).

```typescript
async getActivityStreams(
  activityId: string,
  accessToken: string,
  streamKeys?: string[]
): Promise<ActivityStreams>
```

**Available Stream Keys:**
- `latlng` - GPS coordinates
- `distance` - Distance in meters
- `altitude` - Elevation in meters
- `heartrate` - Heart rate in BPM
- `cadence` - Cadence (RPM for cycling, steps/min for running)
- `watts` - Power in watts
- `temp` - Temperature in Celsius
- `moving` - Boolean for moving/stopped
- `grade_smooth` - Smoothed grade percentage

**Example:**
```typescript
const streams = await strava.api.getActivityStreams(
  activityId,
  accessToken,
  ["latlng", "heartrate", "distance"]
);
```

### `updateActivity(activityId, accessToken, updateData)`

Update activity details.

```typescript
async updateActivity(
  activityId: string,
  accessToken: string,
  updateData: StravaUpdateData
): Promise<StravaActivity>
```

**Update Data:**
```typescript
interface StravaUpdateData {
  name?: string;               // Activity name
  description?: string;        // Activity description
  type?: string;               // Activity type (Ride, Run, etc.)
  gear_id?: string;           // Gear/equipment ID
  trainer?: boolean;          // Trainer activity
  commute?: boolean;          // Commute flag
}
```

### `refreshAccessToken(refreshToken)`

Manually refresh access token.

```typescript
async refreshAccessToken(
  refreshToken: string
): Promise<TokenRefreshResponse>
```

### `ensureValidToken(accessToken, refreshToken, expiresAt)`

Ensure token is valid, refresh if needed (within 5-minute buffer).

```typescript
async ensureValidToken(
  accessToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<TokenData>
```

**Returns:**
```typescript
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  wasRefreshed: boolean;       // True if token was refreshed
}
```

## Webhooks

Webhook management accessed via `strava.webhooks`.

### Event Handlers

Register handlers for webhook events:

#### `onActivityCreate(handler)`

Called when a new activity is created.

```typescript
onActivityCreate(
  handler: (event: WebhookEvent, athleteId: number) => void | Promise<void>
): void
```

#### `onActivityUpdate(handler)`

Called when an activity is updated.

```typescript
onActivityUpdate(
  handler: (event: WebhookEvent, athleteId: number) => void | Promise<void>
): void
```

#### `onActivityDelete(handler)`

Called when an activity is deleted.

```typescript
onActivityDelete(
  handler: (event: WebhookEvent, athleteId: number) => void | Promise<void>
): void
```

#### `onAthleteDeauthorize(handler)`

Called when an athlete deauthorizes your app.

```typescript
onAthleteDeauthorize(
  handler: (event: WebhookEvent, athleteId: number) => void | Promise<void>
): void
```

**WebhookEvent Type:**
```typescript
interface WebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;           // Activity or athlete ID
  aspect_type: "create" | "update" | "delete";
  updates?: Record<string, any>;
  owner_id: number;            // Athlete ID
  subscription_id: number;
  event_time: number;          // Unix timestamp
}
```

### `createSubscription(options)`

Create webhook subscription.

```typescript
async createSubscription(options: {
  callbackUrl: string;
  verifyToken: string;
}): Promise<WebhookSubscription>
```

### `listSubscriptions()`

List active webhook subscriptions.

```typescript
async listSubscriptions(): Promise<WebhookSubscription[]>
```

### `deleteSubscription(subscriptionId)`

Delete webhook subscription.

```typescript
async deleteSubscription(subscriptionId: number): Promise<void>
```

## Storage

Token storage interface that you must implement.

### Interface

```typescript
interface TokenStorage {
  getTokens(athleteId: string): Promise<StoredTokens | null>;
  saveTokens(athleteId: string, tokens: StoredTokens): Promise<void>;
  deleteTokens(athleteId: string): Promise<void>;
}

interface StoredTokens {
  athleteId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
```

See [Storage Guide](./storage.md) for implementation examples.

## Types

### Configuration Types

```typescript
interface RateLimitConfig {
  maxConcurrent?: number;      // Max concurrent requests (default: 1)
  minTime?: number;            // Min time between requests in ms (default: 6000)
}

interface RetryConfig {
  maxRetries?: number;         // Max retry attempts (default: 3)
  retryDelay?: number;         // Initial retry delay in ms (default: 1000)
}

interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}
```

### Callback Types

```typescript
interface ApiCallInfo {
  service: string;
  endpoint: string;
  method: string;
  duration: number;            // Milliseconds
  statusCode?: number;
  error?: string;
}

interface RateLimitInfo {
  shortTerm: number;           // Requests used (15 min)
  longTerm: number;            // Requests used (24 hr)
  shortTermLimit: number;      // Limit (15 min)
  longTermLimit: number;       // Limit (24 hr)
}
```

### Activity Types

```typescript
interface StravaActivity {
  id: number;
  name: string;
  distance: number;            // Meters
  moving_time: number;         // Seconds
  elapsed_time: number;        // Seconds
  total_elevation_gain: number;
  type: string;                // "Ride", "Run", etc.
  start_date: string;
  start_date_local: string;
  timezone: string;
  achievement_count: number;
  kudos_count: number;
  comment_count: number;
  athlete_count: number;
  photo_count: number;
  map: {
    id: string;
    summary_polyline: string;
    resource_state: number;
  };
  trainer: boolean;
  commute: boolean;
  manual: boolean;
  private: boolean;
  flagged: boolean;
  // ... many more fields
}
```

## Utilities

### `classifyError(error, context?)`

Classify errors for better handling.

```typescript
function classifyError(
  error: any,
  context?: string
): {
  message: string;
  errorCode: string;
  isRetryable: boolean;
  statusCode?: number;
}
```

**Error Codes:**
- `UNAUTHORIZED` - Invalid or expired token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `RATE_LIMITED` - Rate limit exceeded
- `NETWORK_ERROR` - Network failure
- `UNKNOWN` - Unknown error

### `validateOAuthConfig(config)`

Validate OAuth configuration.

```typescript
function validateOAuthConfig(config: OAuthConfig): string[]
```

Returns array of validation errors (empty if valid).

### `createRateLimiter(config?)`

Create Bottleneck rate limiter instance.

```typescript
function createRateLimiter(config?: RateLimitConfig): Bottleneck
```

## Express Integration

Pre-built handlers for Express.js.

```typescript
import { createExpressHandlers } from "strava-sdk";

const handlers = createExpressHandlers(strava, verifyToken);
```

### OAuth Handlers

```typescript
// Authorization redirect
app.get("/auth", handlers.oauth.authorize());

// Callback handler
app.get("/callback", handlers.oauth.callback({
  onSuccess: async (req, res, tokens) => {
    // Save tokens and redirect
  },
  onError: (req, res, error) => {
    // Handle error
  }
}));
```

### Webhook Handlers

```typescript
// Verification (GET)
app.get("/webhook", handlers.webhooks.verify());

// Events (POST)
app.post("/webhook", handlers.webhooks.events());
```

## Error Handling

All SDK methods can throw errors. Use try-catch:

```typescript
import { StravaError, StravaAuthError, StravaApiError } from "strava-sdk";

try {
  const activity = await strava.getActivityWithRefresh(activityId, athleteId);
} catch (error) {
  if (error instanceof StravaAuthError) {
    // Authentication failed
  } else if (error instanceof StravaApiError) {
    // API call failed
    console.error(`API error (${error.statusCode}): ${error.message}`);
  } else if (error instanceof StravaError) {
    // General SDK error
  }
}
```

## Rate Limiting

The SDK automatically handles Strava's rate limits:
- **200 requests per 15 minutes**
- **2000 requests per day**

Default configuration uses 6 seconds between requests (10 requests/min) to stay well under limits.

Monitor rate limit usage:

```typescript
const strava = new StravaClient({
  // ...config
  onRateLimit: (info) => {
    console.log(`15-min: ${info.shortTerm}/${info.shortTermLimit}`);
    console.log(`Daily: ${info.longTerm}/${info.longTermLimit}`);
  }
});
```

## TypeScript

The SDK is fully typed. Import types as needed:

```typescript
import type {
  StravaActivity,
  StravaUpdateData,
  OAuthTokenResponse,
  WebhookEvent,
  StoredTokens,
  TokenStorage
} from "strava-sdk";
```
