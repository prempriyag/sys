-- Table: eci_roll_selections
-- One row per ECI download form selection (state, year, district, assembly constituency, language, pdf_path, etc.)
-- For a new DB: run the CREATE TABLE block below. For an existing table missing pdf_path: run only the ALTER at the end.

-- Create table with all columns (run this if the table does not exist)
CREATE TABLE IF NOT EXISTS eci_roll_selections (
    id SERIAL PRIMARY KEY,
    state VARCHAR(150) NOT NULL,
    year_of_revision VARCHAR(20) NOT NULL,
    district VARCHAR(150) NOT NULL,
    assembly_constituency VARCHAR(200) NOT NULL,
    language VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    pdf_path VARCHAR(1000)
);

-- Indexes (optional; create if you need them for queries)
CREATE INDEX IF NOT EXISTS ix_eci_roll_selections_state ON eci_roll_selections (state);
CREATE INDEX IF NOT EXISTS ix_eci_roll_selections_year_of_revision ON eci_roll_selections (year_of_revision);
CREATE INDEX IF NOT EXISTS ix_eci_roll_selections_district ON eci_roll_selections (district);
CREATE INDEX IF NOT EXISTS ix_eci_roll_selections_assembly_constituency ON eci_roll_selections (assembly_constituency);
CREATE INDEX IF NOT EXISTS ix_eci_roll_selections_language ON eci_roll_selections (language);
CREATE INDEX IF NOT EXISTS ix_eci_roll_selections_created_by ON eci_roll_selections (created_by);

-- Add missing columns (run only if the table existed without them):
-- ALTER TABLE eci_roll_selections ADD COLUMN IF NOT EXISTS language VARCHAR(100);
-- ALTER TABLE eci_roll_selections ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE eci_roll_selections ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Add pdf_path (run only when the table exists but does not have pdf_path yet):
ALTER TABLE eci_roll_selections
ADD COLUMN pdf_path VARCHAR(1000);
