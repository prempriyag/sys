-- Table: epic_downloads

CREATE TABLE IF NOT EXISTS epic_downloads (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(10) NOT NULL UNIQUE,
    state VARCHAR(150),
    year VARCHAR(20),
    role VARCHAR(100),
    district VARCHAR(150),
    constancy VARCHAR(200),
    language VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'new',
    created_by VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_epic_downloads_batch_id ON epic_downloads (batch_id);
CREATE INDEX IF NOT EXISTS ix_epic_downloads_state ON epic_downloads (state);
CREATE INDEX IF NOT EXISTS ix_epic_downloads_year ON epic_downloads (year);
CREATE INDEX IF NOT EXISTS ix_epic_downloads_status ON epic_downloads (status);
