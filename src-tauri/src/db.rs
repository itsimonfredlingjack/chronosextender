use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::{params, Connection, Result};

use crate::models::*;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::db_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn db_path() -> PathBuf {
        let data_dir = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        data_dir.join("dev.chronos").join("chronos.db")
    }

    pub fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT NOT NULL,
                end_time TEXT,
                app_bundle_id TEXT NOT NULL,
                app_name TEXT NOT NULL,
                window_title TEXT,
                browser_url TEXT,
                duration_seconds INTEGER DEFAULT 0,
                category TEXT,
                project TEXT,
                task_description TEXT,
                confidence REAL DEFAULT 0.0,
                classification_source TEXT DEFAULT 'pending',
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_time);
            CREATE INDEX IF NOT EXISTS idx_events_project ON events(project);
            CREATE INDEX IF NOT EXISTS idx_events_source ON events(classification_source);

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                client TEXT,
                hourly_rate REAL,
                color TEXT DEFAULT '#6366f1',
                is_billable INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                priority INTEGER DEFAULT 100,
                match_type TEXT NOT NULL,
                match_value TEXT NOT NULL,
                target_category TEXT,
                target_project_id INTEGER,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (target_project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_type TEXT NOT NULL,
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                summary_json TEXT NOT NULL,
                generated_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS flow_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                primary_app TEXT NOT NULL,
                primary_project TEXT,
                duration_minutes INTEGER NOT NULL,
                interrupted INTEGER DEFAULT 0,
                interrupted_by TEXT
            );
            ",
        )?;
        self.seed_default_rules(&conn)?;
        Ok(())
    }

    fn seed_default_rules(&self, conn: &Connection) -> Result<()> {
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM rules", [], |r| r.get(0))?;
        if count > 0 {
            return Ok(());
        }

        let defaults = [
            ("app_name", "Ghostty", "coding"),
            ("app_name", "Terminal", "coding"),
            ("app_name", "iTerm2", "coding"),
            ("app_name", "Visual Studio Code", "coding"),
            ("app_name", "Cursor", "coding"),
            ("app_name", "Xcode", "coding"),
            ("bundle_id", "com.tinyspeck.slackmacgap", "communication"),
            ("bundle_id", "com.hnc.Discord", "communication"),
            ("app_name", "Zoom", "meeting"),
            ("app_name", "FaceTime", "meeting"),
            ("app_name", "Figma", "design"),
            ("app_name", "Google Chrome", "browsing"),
            ("app_name", "Safari", "browsing"),
            ("app_name", "Firefox", "browsing"),
            ("app_name", "Finder", "admin"),
            ("app_name", "System Settings", "admin"),
        ];

        for (i, (match_type, match_value, category)) in defaults.iter().enumerate() {
            conn.execute(
                "INSERT INTO rules (priority, match_type, match_value, target_category)
                 VALUES (?1, ?2, ?3, ?4)",
                params![i as i64 + 1, match_type, match_value, category],
            )?;
        }

        log::info!("Seeded {} default classification rules", defaults.len());
        Ok(())
    }

    // --- Events ---

    pub fn insert_event(&self, event: &NewEvent) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO events (start_time, app_bundle_id, app_name, window_title, browser_url)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                event.start_time,
                event.app_bundle_id,
                event.app_name,
                event.window_title,
                event.browser_url,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn close_event(&self, id: i64, end_time: &str, duration: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE events SET end_time = ?1, duration_seconds = ?2 WHERE id = ?3",
            params![end_time, duration, id],
        )?;
        Ok(())
    }

    pub fn update_event_duration(&self, id: i64, duration: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE events SET duration_seconds = ?1 WHERE id = ?2",
            params![duration, id],
        )?;
        Ok(())
    }

    pub fn update_event_classification(
        &self,
        id: i64,
        result: &ClassificationResult,
        source: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE events SET category = ?1, project = ?2, task_description = ?3,
             confidence = ?4, classification_source = ?5 WHERE id = ?6",
            params![
                result.category,
                result.project,
                result.task_description,
                result.confidence,
                source,
                id,
            ],
        )?;
        Ok(())
    }

    pub fn update_event_url(&self, id: i64, url: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE events SET browser_url = ?1 WHERE id = ?2",
            params![url, id],
        )?;
        Ok(())
    }

    pub fn get_events_for_date(&self, date: &str) -> Result<Vec<Event>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, start_time, end_time, app_bundle_id, app_name, window_title,
                    browser_url, duration_seconds, category, project, task_description,
                    confidence, classification_source, created_at
             FROM events
             WHERE date(start_time) = ?1
             ORDER BY start_time ASC",
        )?;
        let events = stmt
            .query_map(params![date], |row| {
                Ok(Event {
                    id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    app_bundle_id: row.get(3)?,
                    app_name: row.get(4)?,
                    window_title: row.get(5)?,
                    browser_url: row.get(6)?,
                    duration_seconds: row.get(7)?,
                    category: row.get(8)?,
                    project: row.get(9)?,
                    task_description: row.get(10)?,
                    confidence: row.get(11)?,
                    classification_source: row.get(12)?,
                    created_at: row.get(13)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(events)
    }

    pub fn get_events_for_date_range(&self, start: &str, end: &str) -> Result<Vec<Event>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, start_time, end_time, app_bundle_id, app_name, window_title,
                    browser_url, duration_seconds, category, project, task_description,
                    confidence, classification_source, created_at
             FROM events
             WHERE date(start_time) >= ?1 AND date(start_time) <= ?2
             ORDER BY start_time ASC",
        )?;
        let events = stmt
            .query_map(params![start, end], |row| {
                Ok(Event {
                    id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    app_bundle_id: row.get(3)?,
                    app_name: row.get(4)?,
                    window_title: row.get(5)?,
                    browser_url: row.get(6)?,
                    duration_seconds: row.get(7)?,
                    category: row.get(8)?,
                    project: row.get(9)?,
                    task_description: row.get(10)?,
                    confidence: row.get(11)?,
                    classification_source: row.get(12)?,
                    created_at: row.get(13)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(events)
    }

    pub fn get_event_dates_since(&self, since: Option<&str>) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        if let Some(date) = since {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT date(start_time)
                 FROM events
                 WHERE date(start_time) >= ?1
                 ORDER BY date(start_time) ASC",
            )?;
            let rows = stmt.query_map(params![date], |row| row.get(0))?;
            rows.collect::<Result<Vec<String>>>()
        } else {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT date(start_time)
                 FROM events
                 ORDER BY date(start_time) ASC",
            )?;
            let rows = stmt.query_map([], |row| row.get(0))?;
            rows.collect::<Result<Vec<String>>>()
        }
    }

    pub fn get_pending_events(&self) -> Result<Vec<Event>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, start_time, end_time, app_bundle_id, app_name, window_title,
                    browser_url, duration_seconds, category, project, task_description,
                    confidence, classification_source, created_at
             FROM events
             WHERE classification_source = 'pending' OR confidence < 0.5
             ORDER BY start_time DESC",
        )?;
        let events = stmt
            .query_map([], |row| {
                Ok(Event {
                    id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    app_bundle_id: row.get(3)?,
                    app_name: row.get(4)?,
                    window_title: row.get(5)?,
                    browser_url: row.get(6)?,
                    duration_seconds: row.get(7)?,
                    category: row.get(8)?,
                    project: row.get(9)?,
                    task_description: row.get(10)?,
                    confidence: row.get(11)?,
                    classification_source: row.get(12)?,
                    created_at: row.get(13)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(events)
    }

    pub fn get_current_event(&self) -> Result<Option<Event>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, start_time, end_time, app_bundle_id, app_name, window_title,
                    browser_url, duration_seconds, category, project, task_description,
                    confidence, classification_source, created_at
             FROM events
             WHERE end_time IS NULL
             ORDER BY start_time DESC LIMIT 1",
        )?;
        let mut rows = stmt.query_map([], |row| {
            Ok(Event {
                id: row.get(0)?,
                start_time: row.get(1)?,
                end_time: row.get(2)?,
                app_bundle_id: row.get(3)?,
                app_name: row.get(4)?,
                window_title: row.get(5)?,
                browser_url: row.get(6)?,
                duration_seconds: row.get(7)?,
                category: row.get(8)?,
                project: row.get(9)?,
                task_description: row.get(10)?,
                confidence: row.get(11)?,
                classification_source: row.get(12)?,
                created_at: row.get(13)?,
            })
        })?;
        Ok(rows.next().transpose()?)
    }

    // --- Projects ---

    pub fn get_all_projects(&self) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, client, hourly_rate, color, is_billable, created_at FROM projects ORDER BY name",
        )?;
        let projects = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    client: row.get(2)?,
                    hourly_rate: row.get(3)?,
                    color: row.get(4)?,
                    is_billable: row.get::<_, i64>(5)? != 0,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(projects)
    }

    pub fn upsert_project(&self, project: &NewProject) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO projects (name, client, hourly_rate, color, is_billable)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(name) DO UPDATE SET
                client = excluded.client,
                hourly_rate = excluded.hourly_rate,
                color = excluded.color,
                is_billable = excluded.is_billable",
            params![
                project.name,
                project.client,
                project.hourly_rate,
                project.color.as_deref().unwrap_or("#6366f1"),
                project.is_billable as i64,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    // --- Rules ---

    pub fn get_rules_ordered(&self) -> Result<Vec<Rule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, priority, match_type, match_value, target_category, target_project_id, created_at
             FROM rules ORDER BY priority ASC",
        )?;
        let rules = stmt
            .query_map([], |row| {
                Ok(Rule {
                    id: row.get(0)?,
                    priority: row.get(1)?,
                    match_type: row.get(2)?,
                    match_value: row.get(3)?,
                    target_category: row.get(4)?,
                    target_project_id: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(rules)
    }

    pub fn insert_rule(&self, rule: &NewRule) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO rules (priority, match_type, match_value, target_category, target_project_id)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                rule.priority.unwrap_or(100),
                rule.match_type,
                rule.match_value,
                rule.target_category,
                rule.target_project_id,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete_rule(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM rules WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_rule_suggestions(&self) -> Result<Vec<RuleSuggestion>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT e.app_name, e.category, COUNT(*) as cnt
             FROM events e
             WHERE e.classification_source = 'llm'
               AND e.category IS NOT NULL
               AND e.category != 'unknown'
               AND e.app_name NOT IN (
                   SELECT r.match_value FROM rules r WHERE r.match_type = 'app_name'
               )
             GROUP BY e.app_name, e.category
             HAVING cnt >= 3
             ORDER BY cnt DESC",
        )?;
        let suggestions = stmt
            .query_map([], |row| {
                Ok(RuleSuggestion {
                    app_name: row.get(0)?,
                    suggested_category: row.get(1)?,
                    event_count: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(suggestions)
    }

    // --- Summaries ---

    pub fn insert_summary(
        &self,
        period_type: &str,
        period_start: &str,
        period_end: &str,
        summary_json: &str,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO summaries (period_type, period_start, period_end, summary_json)
             VALUES (?1, ?2, ?3, ?4)",
            params![period_type, period_start, period_end, summary_json],
        )?;
        Ok(conn.last_insert_rowid())
    }

    // --- Manual Events ---

    pub fn insert_manual_event(
        &self,
        start_time: &str,
        end_time: &str,
        duration_seconds: i64,
        category: &str,
        project: Option<&str>,
        task_description: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO events (start_time, end_time, app_bundle_id, app_name, duration_seconds,
             category, project, task_description, confidence, classification_source)
             VALUES (?1, ?2, 'manual', 'Manual Entry', ?3, ?4, ?5, ?6, 1.0, 'manual')",
            params![
                start_time,
                end_time,
                duration_seconds,
                category,
                project,
                task_description
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    // --- Daily Summary ---

    pub fn get_daily_summary(&self, date: &str) -> Result<Option<Summary>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, period_type, period_start, period_end, summary_json, generated_at
             FROM summaries WHERE period_type = 'daily' AND period_start = ?1
             ORDER BY generated_at DESC LIMIT 1",
        )?;
        let mut rows = stmt.query_map(params![date], |row| {
            Ok(Summary {
                id: row.get(0)?,
                period_type: row.get(1)?,
                period_start: row.get(2)?,
                period_end: row.get(3)?,
                summary_json: row.get(4)?,
                generated_at: row.get(5)?,
            })
        })?;
        Ok(rows.next().transpose()?)
    }

    pub fn get_summary_dates_since(&self, since: Option<&str>) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        if let Some(date) = since {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT period_start
                 FROM summaries
                 WHERE period_type = 'daily' AND period_start >= ?1
                 ORDER BY period_start ASC",
            )?;
            let rows = stmt.query_map(params![date], |row| row.get(0))?;
            rows.collect::<Result<Vec<String>>>()
        } else {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT period_start
                 FROM summaries
                 WHERE period_type = 'daily'
                 ORDER BY period_start ASC",
            )?;
            let rows = stmt.query_map([], |row| row.get(0))?;
            rows.collect::<Result<Vec<String>>>()
        }
    }

    // --- Flow Sessions ---

    pub fn insert_flow_session(
        &self,
        start_time: &str,
        end_time: &str,
        primary_app: &str,
        primary_project: Option<&str>,
        duration_minutes: i64,
        interrupted: bool,
        interrupted_by: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO flow_sessions (start_time, end_time, primary_app, primary_project,
             duration_minutes, interrupted, interrupted_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                start_time,
                end_time,
                primary_app,
                primary_project,
                duration_minutes,
                interrupted as i64,
                interrupted_by,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_flow_sessions_for_date(&self, date: &str) -> Result<Vec<FlowSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, start_time, end_time, primary_app, primary_project,
                    duration_minutes, interrupted, interrupted_by
             FROM flow_sessions
             WHERE date(start_time) = ?1
             ORDER BY start_time ASC",
        )?;
        let sessions = stmt
            .query_map(params![date], |row| {
                Ok(FlowSession {
                    id: row.get(0)?,
                    start_time: row.get(1)?,
                    end_time: row.get(2)?,
                    primary_app: row.get(3)?,
                    primary_project: row.get(4)?,
                    duration_minutes: row.get(5)?,
                    interrupted: row.get::<_, i64>(6)? != 0,
                    interrupted_by: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(sessions)
    }

    pub fn get_flow_session_dates_since(&self, since: Option<&str>) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        if let Some(date) = since {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT date(start_time)
                 FROM flow_sessions
                 WHERE date(start_time) >= ?1
                 ORDER BY date(start_time) ASC",
            )?;
            let rows = stmt.query_map(params![date], |row| row.get(0))?;
            rows.collect::<Result<Vec<String>>>()
        } else {
            let mut stmt = conn.prepare(
                "SELECT DISTINCT date(start_time)
                 FROM flow_sessions
                 ORDER BY date(start_time) ASC",
            )?;
            let rows = stmt.query_map([], |row| row.get(0))?;
            rows.collect::<Result<Vec<String>>>()
        }
    }
}
