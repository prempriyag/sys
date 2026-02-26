-- Voter data: one row per voter, EPIC unique.
-- Used by POST /api/upload/bulk-electoral-roll (read PDFs one by one, insert only pages with voter data).
-- PostgreSQL.

CREATE TABLE IF NOT EXISTS voter_data (
    id                BIGSERIAL PRIMARY KEY,
    epic_number       VARCHAR(20) NOT NULL,
    name              TEXT,
    relative_name     TEXT,
    age               INTEGER,
    gender            VARCHAR(10),
    house_no          VARCHAR(200),
    address           TEXT,
    constituency_name VARCHAR(200),
    year              VARCHAR(20),
    booth_number      VARCHAR(50),
    source_pdf        VARCHAR(500),
    page_number       INTEGER,
    confidence        NUMERIC(5, 4),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_voter_data_epic UNIQUE (epic_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_voter_data_epic_number ON voter_data (epic_number);

COMMENT ON TABLE voter_data IS 'Bulk electoral roll: one row per voter; EPIC unique. Insert with ON CONFLICT (epic_number) DO NOTHING.';
