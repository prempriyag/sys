-- Table: epic_voter_files

CREATE TABLE IF NOT EXISTS epic_voter_files (
    id SERIAL PRIMARY KEY,
    downloaded_id INTEGER NOT NULL REFERENCES epic_downloads(id) ON DELETE CASCADE,
    batch_id VARCHAR(10) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_epic_voter_files_downloaded_id ON epic_voter_files (downloaded_id);
CREATE INDEX IF NOT EXISTS ix_epic_voter_files_batch_id ON epic_voter_files (batch_id);
CREATE INDEX IF NOT EXISTS ix_epic_voter_files_status ON epic_voter_files (status);
