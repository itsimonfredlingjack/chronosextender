# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chronos AI is a local macOS desktop app that passively tracks active windows, classifies sessions via local LLM (Ollama), and presents productivity insights. All data stays local — no cloud, no telemetry.

**Stack:** Tauri 2.0 + Rust backend + React/TypeScript frontend + Ollama (local LLM)
**Target:** macOS Apple Silicon, 16GB RAM

## Architecture

The app has three main components:

1. **Rust Daemon** (`src-tauri/src/daemon/`) — Runs continuously. Tracks active window via `active-win-pos-rs` (event-driven, not polling). Classifies events through a pipeline: rules table first, then Ollama LLM, then marks as pending. Detects flow states (20+ min uninterrupted work). Hosts a WebSocket server on `ws://localhost:19876` for the browser extension.

2. **Tauri App** (`src-tauri/src/`) — React frontend communicates with Rust backend via Tauri IPC commands. Dashboard, timeline, project management, review queue, reports, and settings views.

3. **Browser Extension** (`extension/`) — Chrome Manifest V3. Sends active tab URL/title to daemon via WebSocket. Minimal permissions (`activeTab` only).

## AI Model Tiers

All models run via Ollama on `localhost:11434`:

- **Tier 1** (`qwen3.5:0.8b`): Always-on classifier. Runs on every window switch. Loaded at startup, stays in memory. <100ms latency on M4.
- **Tier 2** (`qwen3.5:4b`): Daily batch summarizer. Loaded on-demand, unloaded after. Reclassifies pending events and generates daily summaries.
- **Tier 3** (`qwen3.5:4b`): Weekly reports/invoices (future).

Model switching requires explicit unload/reload via Ollama API (`keep_alive` parameter).

## Classification Pipeline

Order (short-circuits on first match):
1. **Rules** — Match against `rules` table by priority. Source: `"rule"`, confidence: `1.0`
2. **LLM** — POST to Ollama `/api/chat` with JSON format enforced. Source: `"llm"`. If confidence < 0.5, mark as `"pending"`
3. **Pending** — If Ollama is down or returns invalid response. Retried in next batch.

Ollama calls use `temperature: 0.1`, `format: "json"`, `num_predict: 200`, timeout 2 seconds.

## Database

SQLite at `~/Library/Application Support/dev.chronos/chronos.db`

Five tables: `events` (window tracking data + classification), `projects` (name, client, hourly rate, color), `rules` (pattern matching for auto-classification), `summaries` (daily/weekly AI-generated reports), `flow_sessions` (detected deep work periods).

Key fields on `events`: `classification_source` (`pending`/`llm`/`rule`/`manual`), `confidence` (0.0-1.0), `browser_url` (from extension).

## Build & Development Commands

```bash
# Initial setup
scripts/setup.sh              # Install Ollama, pull models, install Rust/Tauri/Node deps

# Development
npm run tauri dev              # Start Tauri dev mode (frontend + backend)
npm install                    # Install frontend dependencies

# Build
npm run tauri build            # Production build (DMG)

# Verify daemon is tracking
sqlite3 ~/Library/Application\ Support/dev.chronos/chronos.db \
  "SELECT * FROM events ORDER BY start_time DESC LIMIT 10;"
```

## Key Configuration

Config file: `~/Library/Application Support/dev.chronos/config.json`

- `tracking.dedup_threshold_seconds: 3` — Ignore window switches shorter than this (alt-tab misses)
- `ai.classify_timeout_ms: 2000` — Ollama call timeout before marking as pending
- `flow_guard.threshold_minutes: 20` — Minutes before flow state activates
- `flow_guard.interrupt_apps` — Bundle IDs that trigger Flow Guard warning

## macOS Permissions Required

- **Accessibility** — Read window focus events and titles
- **Screen Recording** — Required by `active-win-pos-rs` for window titles (no screenshots taken)

## Rust Dependencies of Note

- `active-win-pos-rs` — macOS window tracking
- `rusqlite` (bundled) — SQLite access
- `reqwest` — HTTP client for Ollama API
- `tokio-tungstenite` — WebSocket server for browser extension
- `tauri 2` with `tray-icon` and `devtools` features

## Frontend Stack

React 19 + TypeScript + Tailwind CSS 4 + Recharts (charts) + date-fns + react-router-dom 7

## File Structure Convention

```
src-tauri/src/daemon/    # Daemon modules: tracker, classifier, flow, websocket, health
src-tauri/src/commands.rs # Tauri IPC commands (frontend API surface)
src-tauri/src/db.rs       # All SQLite operations
src-tauri/src/models.rs   # Rust structs (Event, Project, Rule, etc.)
src/pages/                # React page components
src/components/           # Reusable React components
src/hooks/                # React hooks (useEvents, useFlowState, useOllamaStatus)
src/lib/                  # Tauri command wrappers + TypeScript types
extension/                # Chrome extension (Manifest V3)
```

## Blueprint Reference

The full build specification is in `CHRONOS_BUILD_BLUEPRINT_v2 (1).md`. It contains detailed SQL schemas, system prompts for the AI classifier, Ollama API call formats, sprint plan, and UI view specifications. Consult it for implementation details.
