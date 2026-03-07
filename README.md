# Chronos Extender

Chronos Extender is a Tauri desktop app for local activity tracking, classification, reporting, and flow insights.

## Desktop app

The desktop UI lives at the repo root with the Rust backend in [src-tauri](/Users/coffeedev/Projects/02_AUTOMATION-PIPELINES/chronosextender/src-tauri).

```bash
npm install
npm run build
cd src-tauri && cargo test --lib
```

## ChatGPT app

The hosted ChatGPT owner pilot lives in [chatgpt-app](/Users/coffeedev/Projects/02_AUTOMATION-PIPELINES/chronosextender/chatgpt-app).

- Cloudflare Worker + D1 backend
- Owner-only sync endpoints for desktop aggregates
- MCP server on `/mcp`
- React report widget for ChatGPT

Convenience commands:

```bash
npm run build:chatgpt-app
npm run test:chatgpt-app
```
