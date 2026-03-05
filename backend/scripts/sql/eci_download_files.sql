-- Table: eci_download_files

CREATE TABLE IF NOT EXISTS eci_download_files (
    id SERIAL PRIMARY KEY,
    download_id INTEGER NOT NULL REFERENCES eci_downloads(id) ON DELETE CASCADE,
    batch VARCHAR(10) NOT NULL UNIQUE,
    file_path VARCHAR(1000) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_eci_download_files_download_id ON eci_download_files (download_id);
CREATE INDEX IF NOT EXISTS ix_eci_download_files_batch ON eci_download_files (batch);
CREATE INDEX IF NOT EXISTS ix_eci_download_files_status ON eci_download_files (status);
