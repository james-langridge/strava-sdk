import express from 'express';
import { StravaClient, MemoryStorage, createExpressHandlers } from 'strava-sdk';

const app = express();
app.use(express.json());

const strava = new StravaClient({
  clientId: process.env.STRAVA_CLIENT_ID!,
  clientSecret: process.env.STRAVA_CLIENT_SECRET!,
  redirectUri: `${process.env.APP_URL}/auth/callback`,
  storage: new MemoryStorage(),
  logger: {
    debug: (msg, meta) => console.log('[DEBUG]', msg, meta),
    info: (msg, meta) => console.log('[INFO]', msg, meta),
    warn: (msg, meta) => console.warn('[WARN]', msg, meta),
    error: (msg, meta) => console.error('[ERROR]', msg, meta),
  },
});

const handlers = createExpressHandlers(
  strava,
  process.env.STRAVA_WEBHOOK_VERIFY_TOKEN!,
);

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Strava SDK Example</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          button { background: #FC4C02; color: white; border: none; padding: 12px 24px; font-size: 16px; cursor: pointer; border-radius: 4px; }
          button:hover { background: #E34402; }
          pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Strava SDK Basic Example</h1>
        <p>This example demonstrates OAuth authentication with Strava.</p>
        <a href="/auth/strava"><button>Connect with Strava</button></a>

        <h2>Features</h2>
        <ul>
          <li>OAuth authorization flow</li>
          <li>Automatic token refresh</li>
          <li>Activity fetching</li>
          <li>Webhook events</li>
        </ul>
      </body>
    </html>
  `);
});

app.get(
  '/auth/strava',
  handlers.oauth.authorize({
    scopes: ['activity:read_all', 'activity:write'],
  }),
);

app.get(
  '/auth/callback',
  handlers.oauth.callback({
    onSuccess: async (req, res, tokens) => {
      const athleteId = tokens.athlete.id.toString();

      await strava.storage.saveTokens(athleteId, {
        athleteId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: new Date(tokens.expires_at * 1000),
        scopes: ['activity:read_all', 'activity:write'],
      });

      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Connected!</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
              button { background: #FC4C02; color: white; border: none; padding: 12px 24px; margin: 5px; font-size: 16px; cursor: pointer; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Successfully Connected!</h1>
            <h2>Athlete Info</h2>
            <pre>${JSON.stringify(tokens.athlete, null, 2)}</pre>
            <a href="/"><button>Home</button></a>
            <a href="/activities/${athleteId}"><button>View Recent Activities</button></a>
          </body>
        </html>
      `);
    },
    onError: (req, res, error) => {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .error { background: #ffebee; border: 1px solid #f44336; padding: 15px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>Authentication Error</h1>
            <div class="error">${error.message}</div>
            <p><a href="/">Try again</a></p>
          </body>
        </html>
      `);
    },
  }),
);

app.get('/activities/:athleteId', async (req, res) => {
  try {
    const { athleteId } = req.params;

    const activity = await strava.getActivityWithRefresh(
      '1234567890',
      athleteId,
    );

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Activity</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>Activity Details</h1>
          <pre>${JSON.stringify(activity, null, 2)}</pre>
          <p><a href="/">Home</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

app.get('/api/webhook', handlers.webhooks.verify());

app.post('/api/webhook', handlers.webhooks.events());

strava.webhooks.onActivityCreate(async (event, athleteId) => {
  console.log(`New activity created: ${event.object_id} by athlete ${athleteId}`);
});

strava.webhooks.onAthleteDeauthorize(async (event, athleteId) => {
  console.log(`Athlete ${athleteId} deauthorized - cleaning up tokens`);
  await strava.storage.deleteTokens(athleteId.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🚀 Strava SDK Example running on http://localhost:${PORT}

Next steps:
1. Visit http://localhost:${PORT}
2. Click "Connect with Strava"
3. Authorize the app
4. See your athlete info

For webhooks:
- Use ngrok to expose your local server
- Create a subscription at POST /api/webhook/create
  `);
});