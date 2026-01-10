-- Flowstate Database Schema
-- SQLite3

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  focus_score REAL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'tab_switch', 'tab_activated', 'url_change',
    'typing', 'idle_start', 'idle_end',
    'window_focus', 'window_blur'
  )),
  url TEXT,
  typing_velocity REAL,
  idle_duration INTEGER,
  metadata TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Insights table
CREATE TABLE IF NOT EXISTS insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL UNIQUE,
  generated_at INTEGER NOT NULL,
  insights_json TEXT NOT NULL,
  recommendations_json TEXT,
  trend TEXT CHECK(trend IN ('improving', 'declining', 'stable')),
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_activities_session_id ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_activities_event_type ON activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_insights_session_id ON insights(session_id);
