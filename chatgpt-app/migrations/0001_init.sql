CREATE TABLE IF NOT EXISTS accounts (
  account_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  platform TEXT,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, device_id),
  FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_summaries (
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  total_hours REAL NOT NULL,
  top_category TEXT NOT NULL,
  top_project TEXT NOT NULL,
  summary TEXT NOT NULL,
  productivity_score REAL NOT NULL,
  event_count INTEGER NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, device_id, date),
  FOREIGN KEY (account_id, device_id) REFERENCES devices(account_id, device_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS project_rollups (
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  project TEXT NOT NULL,
  client TEXT,
  color TEXT NOT NULL,
  billable INTEGER NOT NULL DEFAULT 0,
  hours REAL NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, device_id, date, project),
  FOREIGN KEY (account_id, device_id) REFERENCES devices(account_id, device_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flow_sessions (
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  primary_app TEXT NOT NULL,
  primary_project TEXT,
  duration_minutes INTEGER NOT NULL,
  interrupted INTEGER NOT NULL DEFAULT 0,
  interrupted_by TEXT,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, device_id, started_at),
  FOREIGN KEY (account_id, device_id) REFERENCES devices(account_id, device_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_state (
  account_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  last_sync_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, device_id),
  FOREIGN KEY (account_id, device_id) REFERENCES devices(account_id, device_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_account_date
  ON daily_summaries (account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_project_rollups_account_date
  ON project_rollups (account_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_flow_sessions_account_date
  ON flow_sessions (account_id, date DESC, started_at DESC);
