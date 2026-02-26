-- Add pdf_name, box_id, relation_type, confidence_score to voter_data (run if data not storing).
-- Use when table already exists but was created with old schema. Then insert uses (pdf_name, box_id).

-- Add columns if missing
ALTER TABLE voter_data ADD COLUMN IF NOT EXISTS pdf_name VARCHAR(255);
ALTER TABLE voter_data ADD COLUMN IF NOT EXISTS box_id INTEGER;
ALTER TABLE voter_data ADD COLUMN IF NOT EXISTS relation_type VARCHAR(20);
ALTER TABLE voter_data ADD COLUMN IF NOT EXISTS confidence_score FLOAT;

-- Create index for pdf_name if not exists
CREATE INDEX IF NOT EXISTS ix_voter_data_pdf_name ON voter_data (pdf_name);

-- Drop old unique on epic_number (so same EPIC can appear in different PDFs)
ALTER TABLE voter_data DROP CONSTRAINT IF EXISTS uq_voter_data_epic;

-- Add unique (pdf_name, box_id) - skip if already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_voter_data_pdf_box'
  ) THEN
    ALTER TABLE voter_data ADD CONSTRAINT uq_voter_data_pdf_box UNIQUE (pdf_name, box_id);
  END IF;
END $$;
