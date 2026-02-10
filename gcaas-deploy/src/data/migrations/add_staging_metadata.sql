-- Migration: Add staging metadata table for unified staging architecture
-- Date: 2025-10-26
-- Purpose: Track all staging tables with metadata for audit trail and cleanup

CREATE TABLE IF NOT EXISTS staging_metadata (
  staging_id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_type TEXT NOT NULL CHECK(data_type IN ('scenario', 'location', 'statement', 'damage_curve', 'hazard_map')),
  file_id INTEGER,
  staging_table_name TEXT UNIQUE NOT NULL,
  original_filename TEXT,
  row_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'mapped', 'ingested', 'error', 'archived')),
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ingested_at DATETIME,
  deleted_at DATETIME,
  FOREIGN KEY (file_id) REFERENCES staged_file(file_id) ON DELETE CASCADE
);

CREATE INDEX idx_staging_metadata_status ON staging_metadata(status);
CREATE INDEX idx_staging_metadata_data_type ON staging_metadata(data_type);
CREATE INDEX idx_staging_metadata_created ON staging_metadata(created_at);
CREATE INDEX idx_staging_metadata_file_id ON staging_metadata(file_id);

-- Add comments for clarity
-- staging_id: Unique identifier for this staging operation
-- data_type: Type of data being staged (scenario, location, etc.)
-- file_id: Reference to the uploaded file in staged_file table
-- staging_table_name: Actual name of the staging table (e.g., staging_scenario_1730000000)
-- original_filename: Original CSV filename for reference
-- row_count: Number of rows imported into staging table
-- status: Current status of the staging operation
--   - pending: Staging table created, data imported
--   - mapped: User has mapped columns
--   - ingested: Data successfully ingested into production tables
--   - error: Error occurred during ingestion
--   - archived: Old staging table marked for cleanup
-- error_message: Error details if status = 'error'
-- created_at: When staging table was created
-- ingested_at: When data was successfully ingested
-- deleted_at: When staging table was dropped (soft delete marker)
