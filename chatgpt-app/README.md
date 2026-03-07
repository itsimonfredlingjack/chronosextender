# Chronos ChatGPT App

This package hosts the owner-pilot ChatGPT app for Chronos on Cloudflare Workers + D1.

## What it includes

- `POST /sync/daily-summary`
- `POST /sync/project-rollups`
- `POST /sync/flow-sessions`
- `GET/POST /mcp`
- A React widget served as static Worker assets
- A D1 schema centered on synced aggregates only

## Local verification

```bash
npm install
npm test
npm run build
```

## Cloudflare setup

1. Create a D1 database and replace `database_id` in [wrangler.jsonc](/Users/coffeedev/Projects/02_AUTOMATION-PIPELINES/chronosextender/chatgpt-app/wrangler.jsonc).
2. Apply the migration:

```bash
npx wrangler d1 migrations apply chronos-chatgpt-app
```

3. Copy `.dev.vars.example` to `.dev.vars` and set a long sync token:

```bash
cp .dev.vars.example .dev.vars
```

4. Point `CHRONOS_APP_ORIGIN` at your Cloudflare subdomain, for example `https://chronos-mcp.yourdomain.com`.
5. Deploy the worker:

```bash
npx wrangler deploy
```

## ChatGPT connection

- Use your deployed `/mcp` URL in ChatGPT Developer Mode.
- Keep the MCP server owner-scoped through `CHRONOS_ACCOUNT_ID`.
- Use the same base origin in the desktop app cloud sync settings.

## Desktop sync settings

In Chronos desktop settings, configure:

- `Cloud Sync Enabled`
- `Hosted Base URL` as your worker origin, for example `https://chronos-mcp.yourdomain.com`
- `Owner Sync Token` to match `CHRONOS_SYNC_TOKEN`

Only summaries, project rollups, and flow sessions are uploaded in this v1. Raw events, window titles, URLs, and full timelines stay local.
