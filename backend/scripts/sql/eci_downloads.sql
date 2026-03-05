-- Table: eci_downloads

CREATE TABLE IF NOT EXISTS eci_downloads (
    id SERIAL PRIMARY KEY,
    state VARCHAR(150) NOT NULL,
    year_of_revision VARCHAR(20) NOT NULL,
    district VARCHAR(150) NOT NULL,
    assembly_constituency VARCHAR(200) NOT NULL,
    language VARCHAR(100),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_eci_downloads_state ON eci_downloads (state);
CREATE INDEX IF NOT EXISTS ix_eci_downloads_year_of_revision ON eci_downloads (year_of_revision);
CREATE INDEX IF NOT EXISTS ix_eci_downloads_district ON eci_downloads (district);
CREATE INDEX IF NOT EXISTS ix_eci_downloads_assembly_constituency ON eci_downloads (assembly_constituency);
CREATE INDEX IF NOT EXISTS ix_eci_downloads_language ON eci_downloads (language);
CREATE INDEX IF NOT EXISTS ix_eci_downloads_created_by ON eci_downloads (created_by);
