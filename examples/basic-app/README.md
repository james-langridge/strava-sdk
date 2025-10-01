# Basic Strava SDK Example

A minimal example showing how to use `strava-sdk` with Express.

## Features

- OAuth authorization flow
- Activity fetching with automatic token refresh
- Webhook event handling
- In-memory token storage (for demo purposes)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file:

```bash
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_WEBHOOK_VERIFY_TOKEN=your_verify_token
APP_URL=http://localhost:3000
PORT=3000
```

3. Get Strava API credentials:
   - Go to https://www.strava.com/settings/api
   - Create an application
   - Copy the Client ID and Client Secret

4. Run the app:

```bash
npm run dev
```

5. Visit `http://localhost:3000` and click "Connect with Strava"

## Usage

### OAuth Flow

1. Visit `/` to see the homepage
2. Click "Connect with Strava"
3. Authorize the app on Strava
4. You'll be redirected back with your athlete info

### Webhooks

1. Set up a webhook subscription at `/webhook/create`
2. Strava will send events to `/api/webhook`
3. Events are logged to the console

## Project Structure

```
src/
  index.ts          # Main Express app
  .env.example      # Environment variables template
```

## Notes

- This example uses `MemoryStorage` which loses data on restart
- For production, implement `TokenStorage` with a real database
- The webhook endpoint must be publicly accessible (use ngrok for local dev)
