-- Add relation_type column to voter_data if missing.
-- Stores: Father | Husband | Mother | Other (relation type only).
-- relative_name stores the person's name (e.g. Kaliyaperumal).

ALTER TABLE voter_data ADD COLUMN IF NOT EXISTS relation_type VARCHAR(20);

COMMENT ON COLUMN voter_data.relation_type IS 'Relation type: Father, Husband, Mother, or Other';
