# CHRONOS AI — BUILD BLUEPRINT v2.0

**Syfte:** Actionable byggdokument. Ge detta till en kodningsmodell och bygg.  
**Target:** macOS (Apple Silicon, 16GB RAM)  
**Stack:** Tauri 2.0 + Rust backend + React frontend + Ollama (lokala LLM)  
**Datum:** 2026-03-04

---

## 1. VAD CHRONOS GÖR

Chronos AI är en lokal desktop-app som:

1. Tyst spårar vilken app och fönsterrubrik du har aktivt (event-driven, inte polling)
2. Klassificerar varje session automatiskt till projekt + kategori via lokal AI
3. Visar daglig tidslinje, projektfördelning och produktivitetsmönster
4. Genererar veckorapporter och fakturafärdiga tidrapporter
5. Skyddar flow states genom att varna vid kontextbyten under deep work

All data stannar lokalt. Ingen molntjänst. Ingen telemetri.

---

## 2. AI-MODELLER (Tiered Architecture)

Alla modeller körs via Ollama på localhost:11434. Chronos pratar med Ollama via HTTP REST API.

### Tier 1 — Always-On Classifier

**Modell:** `qwen3.5:0.8b`  
**Storlek:** 1.0 GB disk, ~1.5 GB RAM laddad  
**Syfte:** Klassificera varje aktivt fönster i realtid  
**Körning:** Laddas vid Chronos-start, stannar i minnet  
**Latens:** <100ms per klassificering på M4  

Input till modellen (JSON):
```json
{
  "app": "Google Chrome",
  "title": "PROJ-1234 Fix auth middleware — Jira",
  "bundle_id": "com.google.Chrome",
  "url": "https://acme.atlassian.net/browse/PROJ-1234",
  "duration_so_far_seconds": 342
}
```

System prompt:
```
Du är en tidklassificerare. Du får metadata om ett aktivt fönster. 
Returnera ENBART JSON, inget annat.

Svara med:
{
  "project": "<projektnamn eller 'unknown'>",
  "category": "<coding|communication|design|documentation|browsing|meeting|admin|entertainment|unknown>",
  "task_description": "<kort beskrivning, max 10 ord>",
  "confidence": <0.0-1.0>,
  "billable": <true|false>
}

Regler:
- Om fönsterrubrik innehåller issue-nummer (t.ex. PROJ-1234), extrahera det som projekt
- VS Code / terminals / IDEs = coding
- Slack / Teams / Discord = communication  
- Figma / Sketch = design
- Google Docs / Notion / Confluence = documentation
- Zoom / Meet / FaceTime = meeting
- Om du inte är säker, sätt confidence < 0.5 och project = "unknown"
```

Output från modellen:
```json
{
  "project": "PROJ-1234",
  "category": "admin",
  "task_description": "Reviewing Jira ticket for auth fix",
  "confidence": 0.87,
  "billable": true
}
```

**Trigger:** Körs vid varje fönsterbyte. INTE vid varje poll — bara när det aktiva fönstret faktiskt ändras. Om du sitter i VS Code i 45 minuter = 1 inference-call, inte 270.

**Fallback:** Om Ollama inte svarar inom 2 sekunder, spara eventet som oklassificerat (`classification_source: "pending"`). Retry i nästa batch.

### Tier 2 — Batch Summarizer

**Modell:** `qwen3.5:4b`  
**Storlek:** 3.4 GB disk, ~4.5 GB RAM laddad  
**Syfte:** Daglig summering + oklassificerade block  
**Körning:** Laddas on-demand, körs en gång per dag (eller manuellt), unloadas efter

Input: Hela dagens SQLite-data som JSON-array.

System prompt:
```
Du är en tidsrapport-generator. Du får en dags aktivitetsdata.

Uppgift 1: Klassificera alla block med classification_source="pending"
Uppgift 2: Generera dagssummering

Returnera JSON:
{
  "reclassified": [
    {"event_id": 123, "project": "...", "category": "...", "confidence": 0.8}
  ],
  "daily_summary": {
    "total_hours": 8.5,
    "deep_work_hours": 4.2,
    "projects": [
      {"name": "SWERAG", "hours": 3.1, "billable": true},
      {"name": "Communication", "hours": 1.5, "billable": false}
    ],
    "flow_sessions": [
      {"start": "09:15", "end": "11:42", "app": "VS Code", "project": "SWERAG"}
    ],
    "fragmentation_score": 0.35,
    "narrative": "Produktiv dag med fokus på SWERAG-utveckling..."
  }
}
```

### Tier 3 — Weekly Report & Invoice (Future, Fas 3)

**Modell:** `qwen3.5:4b` (samma modell, längre prompt)  
**Syfte:** Veckorapport, fakturautkast  
**Körning:** En gång per vecka, manuellt trigger

---

## 3. SYSTEMARKITEKTUR

```
┌──────────────────────────────────────────────────┐
│                   macOS                           │
│                                                   │
│  ┌─────────────┐         ┌──────────────────┐    │
│  │ Chronos      │         │ Ollama            │    │
│  │ Daemon       │◄──HTTP──►│ localhost:11434   │    │
│  │ (Rust)       │         │                   │    │
│  │              │         │ qwen3.5:0.8b      │    │
│  │ • Window     │         │ qwen3.5:4b        │    │
│  │   tracker    │         └──────────────────┘    │
│  │ • Event      │                                  │
│  │   deduper    │         ┌──────────────────┐    │
│  │ • SQLite     │◄───────►│ chronos.db        │    │
│  │   writer     │         │ (SQLite)          │    │
│  │ • Classifier │         └──────────────────┘    │
│  │   bridge     │                                  │
│  └──────┬───────┘         ┌──────────────────┐    │
│         │                 │ Tauri 2.0 App     │    │
│         │    IPC          │ (React frontend)  │    │
│         └────────────────►│                   │    │
│                           │ • Dashboard       │    │
│  ┌─────────────┐         │ • Timeline        │    │
│  │ Browser Ext  │──WS────►│ • Reports         │    │
│  │ (Chrome/FF)  │         │ • Settings        │    │
│  └─────────────┘         │ • Flow Guard      │    │
│                           └──────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

## 4. DATAMODELL (SQLite)

Databasfil: `~/Library/Application Support/dev.chronos/chronos.db`

### Tabell: events

```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,           -- ISO 8601
    end_time TEXT,                       -- NULL = pågående
    app_bundle_id TEXT NOT NULL,         -- com.google.Chrome
    app_name TEXT NOT NULL,              -- Google Chrome
    window_title TEXT,                   -- kan vara tom
    browser_url TEXT,                    -- från extension, nullable
    duration_seconds INTEGER DEFAULT 0,
    category TEXT,                       -- coding, communication, etc
    project TEXT,                        -- projektnamn eller NULL
    task_description TEXT,               -- kort AI-genererad beskrivning
    confidence REAL DEFAULT 0.0,         -- 0.0-1.0
    classification_source TEXT DEFAULT 'pending',  -- pending, llm, rule, manual
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_events_start ON events(start_time);
CREATE INDEX idx_events_project ON events(project);
CREATE INDEX idx_events_source ON events(classification_source);
```

### Tabell: projects

```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    client TEXT,
    hourly_rate REAL,                   -- SEK per timme
    color TEXT DEFAULT '#6366f1',        -- hex för UI
    is_billable INTEGER DEFAULT 1,      -- 0 eller 1
    created_at TEXT DEFAULT (datetime('now'))
);
```

### Tabell: rules

```sql
CREATE TABLE rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    priority INTEGER DEFAULT 100,       -- lägre = körs först
    match_type TEXT NOT NULL,            -- app_name, title_contains, title_regex, url_contains, bundle_id
    match_value TEXT NOT NULL,           -- värdet att matcha mot
    target_category TEXT,               -- optional override
    target_project_id INTEGER,          -- optional override
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (target_project_id) REFERENCES projects(id)
);
```

### Tabell: summaries

```sql
CREATE TABLE summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_type TEXT NOT NULL,           -- daily, weekly
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    summary_json TEXT NOT NULL,          -- full JSON från Tier 2/3
    generated_at TEXT DEFAULT (datetime('now'))
);
```

### Tabell: flow_sessions

```sql
CREATE TABLE flow_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    primary_app TEXT NOT NULL,
    primary_project TEXT,
    duration_minutes INTEGER NOT NULL,
    interrupted INTEGER DEFAULT 0,      -- 0 eller 1
    interrupted_by TEXT                  -- appnamn som bröt flow
);
```

---

## 5. RUST DAEMON — Specifikation

### 5.1 Window Tracking

**Crate:** `active-win-pos-rs`  
**Metod:** Event-driven via `NSWorkspace.didActivateApplicationNotification`  
**Fallback:** Poll var 30 sekund för edge cases  
**Permissions:** Accessibility + Screen Recording (krävs för window titles på macOS)

Vid varje fönsterbyte:
1. Läs `app_name`, `window_title`, `bundle_id`, `process_id`
2. Jämför med senaste event i minnet
3. Om samma app + titel → uppdatera `duration_seconds` på befintlig rad
4. Om ny app ELLER ny titel → stäng föregående event (sätt `end_time`), skapa ny rad
5. Kör klassificering (se 5.2)

**Deduplicering:** Om användaren byter till Chrome och tillbaka till VS Code inom 3 sekunder, ignorera bytet (det var troligen alt-tab-miss). Konfigurerbar threshold.

### 5.2 Klassificerings-pipeline

Ordning (kort-slutar vid första match):

1. **Regler** — Matcha mot `rules`-tabellen i prioritetsordning. Om match → sätt category/project, `classification_source = "rule"`, `confidence = 1.0`. Klart.

2. **LLM (Tier 1)** — Om ingen regel matchar:
   - Bygg JSON-input (app, title, bundle_id, url om tillgänglig)
   - POST till `http://localhost:11434/api/chat` med modell `qwen3.5:0.8b`
   - Parse JSON-response
   - Spara med `classification_source = "llm"`
   - Om confidence < 0.5 → sätt `classification_source = "pending"` för manuell review

3. **Pending** — Om Ollama inte svarar eller ger ogiltigt svar → `classification_source = "pending"`

### 5.3 Ollama-kommunikation

```
POST http://localhost:11434/api/chat
Content-Type: application/json

{
  "model": "qwen3.5:0.8b",
  "messages": [
    {"role": "system", "content": "<system prompt>"},
    {"role": "user", "content": "<JSON med window metadata>"}
  ],
  "stream": false,
  "format": "json",
  "options": {
    "temperature": 0.1,
    "num_predict": 200
  }
}
```

`format: "json"` tvingar Ollama att returnera giltig JSON. `temperature: 0.1` för deterministisk output — vi vill ha konsekventa klassificeringar, inte kreativitet.

### 5.4 Health Check

Vid daemon-start:
1. Kolla om Ollama kör: `GET http://localhost:11434/api/tags`
2. Kolla om `qwen3.5:0.8b` finns i modellistan
3. Om ej → logga varning, kör i "rules-only mode"
4. Om Ollama finns men modell saknas → försök `ollama pull qwen3.5:0.8b` (kräver terminal-access, annars visa instruktion i UI)

### 5.5 Browser Extension Bridge

WebSocket-server på `ws://localhost:19876`

Extension skickar:
```json
{
  "type": "tab_update",
  "url": "https://acme.atlassian.net/browse/PROJ-1234",
  "title": "PROJ-1234 Fix auth middleware — Jira",
  "timestamp": "2026-03-04T14:32:00Z"
}
```

Daemon sparar URL i `browser_url`-fältet på aktuellt event. Skickas med till LLM för rikare kontext.

### 5.6 Flow State Detection

Algoritm (körs i daemon, inget LLM):

1. Spåra tiden i samma app utan avbrott (app_switch_count = 0)
2. Om `duration_in_same_app >= 20 minuter` → markera som flow state
3. Om användaren byter till en "interrupt-app" (Slack, Discord, Mail, Messages) → trigga Flow Guard
4. Flow Guard skickar IPC till Tauri-appen → visa popup

Konfiguration (i settings):
- `flow_threshold_minutes: 20` (hur länge innan flow state aktiveras)
- `interrupt_apps: ["com.tinyspeck.slackmacgap", "com.apple.MobileSMS", "com.apple.mail"]`
- `flow_guard_enabled: true`

### 5.7 Daemon Lifecycle

- Körs som macOS Launch Agent: `~/Library/LaunchAgents/dev.chronos.daemon.plist`
- Startar automatiskt vid login
- Skriver PID till `~/Library/Application Support/dev.chronos/daemon.pid`
- Graceful shutdown vid SIGTERM: stäng alla öppna events, flush SQLite WAL
- Loggar till `~/Library/Logs/chronos/daemon.log`

---

## 6. TAURI APP — Specifikation

### 6.1 Setup

```bash
npm create tauri-app@latest chronos -- --template react-ts
cd chronos
```

Frontend: React + TypeScript + Tailwind CSS  
Backend: Tauri 2.0 Rust commands  
DB-access: Rust backend läser SQLite direkt, exponerar via Tauri commands

### 6.2 Tauri Commands (Rust → Frontend)

```rust
#[tauri::command]
fn get_today_events() -> Vec<Event> { ... }

#[tauri::command]  
fn get_timeline(date: String) -> Timeline { ... }

#[tauri::command]
fn get_project_summary(start: String, end: String) -> ProjectSummary { ... }

#[tauri::command]
fn reclassify_event(event_id: i64, project: String, category: String) -> bool { ... }

#[tauri::command]
fn add_rule(match_type: String, match_value: String, target_category: String, target_project_id: Option<i64>) -> bool { ... }

#[tauri::command]
fn trigger_daily_summary() -> DailySummary { ... }

#[tauri::command]
fn get_flow_status() -> FlowStatus { ... }

#[tauri::command]
fn get_settings() -> Settings { ... }

#[tauri::command]
fn update_settings(settings: Settings) -> bool { ... }
```

### 6.3 UI Vyer

**Dashboard (huvudvy)**
- Dagens totaltid
- Cirkeldiagram: tid per kategori
- Stapeldiagram: tid per projekt
- Aktuell aktivitet (live): app + titel + kategori + tid
- Flow state-indikator (orb)

**Timeline**
- Horisontell tidslinje, timme för timme
- Färgkodade block per kategori
- Klickbara block → detaljer + möjlighet att reklassificera
- Datumväljare

**Projects**
- Lista alla projekt
- Per projekt: total tid, billable timmar, genomsnitt per dag
- Skapa/redigera projekt (namn, klient, timpris, färg)

**Reports**
- Dagrapport / veckorapport
- Export: JSON, CSV
- Trigger Tier 2 summering
- Fakturautkast (Fas 3)

**Review Queue**
- Lista alla events med `classification_source = "pending"` eller `confidence < 0.5`
- Snabb-klassificera: välj projekt + kategori
- "Create rule from this" — generera en regel baserat på manuell klassificering

**Settings**
- Ollama-status (connected/disconnected, laddad modell)
- Flow Guard on/off, threshold
- Interrupt-appar lista
- Regler (CRUD)
- Export/import databas
- Deduplication threshold (sekunder)

### 6.4 System Tray

- Ikon i menyraden
- Visar aktuell aktivitet (projektnamn + tid)
- Quick actions: Pause tracking, Resume, Open dashboard
- Flow state-indikator (ikon ändrar färg)

### 6.5 Flow Guard Popup

Separat Tauri-fönster (multi-webview):
- Litet, floating, always-on-top
- Meddelande: "Du har varit i flow i 47 min. Vill du verkligen öppna Slack?"
- Knappar: "Öppna ändå" / "Stanna fokuserad" / "Snooze 15 min"
- Loggar användarens val i flow_sessions

---

## 7. BROWSER EXTENSION — Specifikation

### Chrome Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Chronos URL Bridge",
  "version": "1.0",
  "permissions": ["activeTab"],
  "background": {
    "service_worker": "background.js"
  }
}
```

**Permissions:** ENBART `activeTab`. Ingen history, inga bookmarks, inga cookies. Minimal attack surface.

**Funktionalitet:**
1. Lyssna på `chrome.tabs.onActivated` och `chrome.tabs.onUpdated`
2. Skicka `{url, title, timestamp}` till `ws://localhost:19876`
3. Om WebSocket ej tillgänglig → buffra i memory, retry var 5:e sekund
4. Ingen lokal lagring, ingen sync, inget moln

---

## 8. FILSTRUKTUR

```
chronos/
├── src-tauri/                     # Tauri/Rust backend
│   ├── src/
│   │   ├── main.rs                # Tauri app entry
│   │   ├── commands.rs            # Tauri commands (frontend API)
│   │   ├── db.rs                  # SQLite operations
│   │   ├── daemon/
│   │   │   ├── mod.rs
│   │   │   ├── tracker.rs         # Window tracking (active-win-pos-rs)
│   │   │   ├── classifier.rs      # Rule engine + Ollama bridge
│   │   │   ├── flow.rs            # Flow state detection
│   │   │   ├── websocket.rs       # Browser extension WS server
│   │   │   └── health.rs          # Ollama health check
│   │   └── models.rs              # Rust structs (Event, Project, Rule, etc)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                           # React frontend
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Timeline.tsx
│   │   ├── Projects.tsx
│   │   ├── Reports.tsx
│   │   ├── ReviewQueue.tsx
│   │   └── Settings.tsx
│   ├── components/
│   │   ├── FlowOrb.tsx            # Flow state visualisering
│   │   ├── FlowGuardPopup.tsx
│   │   ├── CategoryPieChart.tsx
│   │   ├── TimelineBar.tsx
│   │   ├── EventCard.tsx
│   │   └── ProjectCard.tsx
│   ├── hooks/
│   │   ├── useEvents.ts
│   │   ├── useFlowState.ts
│   │   └── useOllamaStatus.ts
│   └── lib/
│       ├── tauri.ts               # Tauri command wrappers
│       └── types.ts               # TypeScript types
├── extension/                     # Browser extension
│   ├── manifest.json
│   ├── background.js
│   └── popup.html                 # Minimal status-popup
└── scripts/
    ├── setup.sh                   # Installera Ollama + pull modeller
    └── dev.sh                     # Starta dev environment
```

---

## 9. DEPENDENCIES

### Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "devtools"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
chrono = { version = "0.4", features = ["serde"] }
active-win-pos-rs = "0.8"
tokio-tungstenite = "0.23"          # WebSocket server
log = "0.4"
env_logger = "0.11"
```

### Frontend (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "recharts": "^2",
    "date-fns": "^4",
    "tailwindcss": "^4"
  }
}
```

---

## 10. BUILD ORDER (Sprint Plan)

### Sprint 1: Daemon Core (Vecka 1-2)

Bygg:
- [ ] Rust-projekt med SQLite-setup (db.rs, models.rs)
- [ ] Window tracker med `active-win-pos-rs` 
- [ ] Event deduplication-logik
- [ ] SQLite CRUD för events-tabellen
- [ ] Daemon lifecycle (PID-fil, signal handling, logging)

Verifiera:
- Kör daemon i terminal, kolla att events sparas i SQLite
- `sqlite3 chronos.db "SELECT * FROM events ORDER BY start_time DESC LIMIT 10;"`

### Sprint 2: Ollama Integration (Vecka 3-4)

Bygg:
- [ ] Health check (is Ollama running? is model loaded?)
- [ ] Classifier bridge — POST till Ollama, parse JSON response
- [ ] System prompt för Tier 1
- [ ] Rule engine — matcha mot rules-tabellen först
- [ ] Fallback-logik (Ollama nere → pending)

Verifiera:
- Byt fönster, kolla att events klassificeras automatiskt
- Jämför LLM-output mot förväntat resultat för 20+ fönsterrubriker

### Sprint 3: Tauri Shell (Vecka 5-6)

Bygg:
- [ ] `npm create tauri-app` med React + TS
- [ ] Tauri commands (get_today_events, get_timeline, etc)
- [ ] Dashboard-vy med live-data
- [ ] System tray med aktuell aktivitet
- [ ] Timeline-vy

Verifiera:
- Dashboard visar live tracking
- System tray uppdateras vid fönsterbyten

### Sprint 4: Review Queue + Rules (Vecka 7-8)

Bygg:
- [ ] Review Queue UI — lista pending events
- [ ] Reklassificera manuellt → uppdatera DB
- [ ] "Create rule from this" — generera regel från manuell input
- [ ] Rules CRUD i settings
- [ ] Feedback loop: manuella val förbättrar framtida klassificering

Verifiera:
- Klassificera 10 pending events manuellt
- Verifiera att genererade regler fångar liknande events automatiskt

### Sprint 5: Browser Extension + Flow Guard (Vecka 9-10)

Bygg:
- [ ] WebSocket server i daemon
- [ ] Chrome extension (Manifest V3)
- [ ] URL-data flödar till events.browser_url
- [ ] Flow state detection i daemon
- [ ] Flow Guard popup (separat Tauri window)
- [ ] Flow sessions logging

Verifiera:
- Öppna Jira i Chrome → URL dyker upp i event-data
- Sitt i VS Code 20+ min → byt till Slack → Flow Guard triggas

### Sprint 6: Reports + Daily Summary (Vecka 11-12)

Bygg:
- [ ] Trigger Tier 2 (Qwen 3.5 4B) daglig summering
- [ ] Ollama model switching (unload 0.8b, load 4b, kör, unload, reload 0.8b)
- [ ] Reports-vy med daglig/veckovis summering
- [ ] Export JSON/CSV
- [ ] Projekt-vy med aggregerad data

Verifiera:
- Generera dagrapport för en full arbetsdag
- Exportera CSV, öppna i Excel — kolumner korrekt

### Sprint 7: Polish + Onboarding (Vecka 13-14)

Bygg:
- [ ] First-run onboarding: förklara permissions, installera Ollama
- [ ] Permission-request flow (Accessibility, Screen Recording)
- [ ] Error states i UI (Ollama nere, modell saknas, etc)
- [ ] Dark mode
- [ ] App-ikon + DMG-build

Verifiera:
- Fresh install på en annan Mac → onboarding flow funkar
- Alla error states hanteras gracefully

### Sprint 8: Invoice + Burnout (Vecka 15-16, stretch)

Bygg:
- [ ] Veckorapport med Tier 2
- [ ] Fakturautkast-generering (PDF eller markdown)
- [ ] Klientprofiler (projekt → klient → timpris)
- [ ] Burnout-indikatorer: fragmentation score trend, deep work trend
- [ ] Productivity insights dashboard

---

## 11. SETUP-SCRIPT

```bash
#!/bin/bash
# scripts/setup.sh — Kör detta på en ny maskin

echo "=== Chronos AI Setup ==="

# 1. Installera Ollama
if ! command -v ollama &> /dev/null; then
    echo "Installerar Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
else
    echo "Ollama redan installerat ✓"
fi

# 2. Starta Ollama
ollama serve &
sleep 3

# 3. Ladda ner modeller
echo "Laddar ner Qwen 3.5 0.8B (Tier 1 — ~1 GB)..."
ollama pull qwen3.5:0.8b

echo "Laddar ner Qwen 3.5 4B (Tier 2 — ~3.4 GB)..."
ollama pull qwen3.5:4b

# 4. Installera Rust (om saknas)
if ! command -v rustc &> /dev/null; then
    echo "Installerar Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

# 5. Installera Tauri CLI
if ! command -v cargo-tauri &> /dev/null; then
    echo "Installerar Tauri CLI..."
    cargo install tauri-cli
fi

# 6. Installera Node dependencies
echo "Installerar frontend dependencies..."
npm install

echo ""
echo "=== Setup klar ==="
echo "Disk använt: ~4.5 GB (modeller)"
echo "Kör: npm run tauri dev"
```

---

## 12. KONFIGURATIONSFIL

`~/Library/Application Support/dev.chronos/config.json`

```json
{
  "tracking": {
    "enabled": true,
    "dedup_threshold_seconds": 3,
    "poll_fallback_seconds": 30
  },
  "ai": {
    "ollama_url": "http://localhost:11434",
    "tier1_model": "qwen3.5:0.8b",
    "tier2_model": "qwen3.5:4b",
    "classify_timeout_ms": 2000,
    "min_confidence_threshold": 0.5
  },
  "flow_guard": {
    "enabled": true,
    "threshold_minutes": 20,
    "interrupt_apps": [
      "com.tinyspeck.slackmacgap",
      "com.apple.MobileSMS",
      "com.apple.mail",
      "com.hnc.Discord"
    ]
  },
  "ui": {
    "theme": "system",
    "show_in_tray": true,
    "show_current_activity_in_tray": true
  }
}
```

---

## 13. macOS PERMISSIONS

Tre permissions krävs. Alla är engångsprompter.

1. **Accessibility** (`kTCCServiceAccessibility`)  
   Krävs för: Läsa fönsterfocus-events, window titles  
   Prompt: "Chronos vill styra din dator" (misvisande macOS-text, men standard)

2. **Screen Recording** (`kTCCServiceScreenCapture`)  
   Krävs för: `active-win-pos-rs` på macOS kräver detta för window titles  
   Chronos tar ALDRIG screenshots  
   Prompt: "Chronos vill spela in din skärm"

3. **Automation** (valfritt, Fas 3+)  
   Krävs för: Läsa Calendar-data  
   Kan vänta

**Entitlements i Tauri:**
```json
{
  "com.apple.security.automation.apple-events": true
}
```

---

## 14. API ENDPOINTS (Ollama)

Referens för alla Ollama-calls daemon behöver:

| Syfte | Metod | URL | Body |
|-------|-------|-----|------|
| Health check | GET | `/api/tags` | — |
| Classify event | POST | `/api/chat` | model, messages, format:"json" |
| Load model | POST | `/api/generate` | model, keep_alive:"10m" |
| Unload model | POST | `/api/generate` | model, keep_alive:"0" |

Model switching-flow för Tier 2:
1. `POST /api/generate {"model": "qwen3.5:0.8b", "keep_alive": "0"}` — unload Tier 1
2. `POST /api/generate {"model": "qwen3.5:4b", "keep_alive": "10m"}` — load Tier 2
3. Kör batch-summering
4. `POST /api/generate {"model": "qwen3.5:4b", "keep_alive": "0"}` — unload Tier 2
5. `POST /api/generate {"model": "qwen3.5:0.8b", "keep_alive": "-1"}` — reload Tier 1 permanent

---

*Blueprint v2.0 klar. Öppna terminalen.*
