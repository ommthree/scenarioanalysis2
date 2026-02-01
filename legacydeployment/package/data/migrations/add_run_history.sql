-- Add run_history table to track all calculation runs
CREATE TABLE IF NOT EXISTS run_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  run_name TEXT NOT NULL,
  run_description TEXT,
  db_path TEXT NOT NULL,
  completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_run_history_user ON run_history(user_id);
CREATE INDEX IF NOT EXISTS idx_run_history_completed ON run_history(completed_at);
