"""Add ocr_voter_uploads columns and indexes for ~7 lakh records

Revision ID: ocr_7lakh
Revises: add_risk_score
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa


revision = "ocr_7lakh"
down_revision = "add_risk_score"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new columns (idempotent for PostgreSQL)
    for col, typ in [
        ("relation_type", "VARCHAR(20)"),
        ("card_index", "INTEGER"),
        ("section_name", "VARCHAR(200)"),
        ("source_block", "TEXT"),
        ("epic_confidence", "NUMERIC(5,4)"),
        ("quality_flag", "VARCHAR(20)"),
    ]:
        op.execute(f"ALTER TABLE ocr_voter_uploads ADD COLUMN IF NOT EXISTS {col} {typ}")
    # Indexes for 7 lakh records: filter by quality, page, constituency, created_at
    op.execute("CREATE INDEX IF NOT EXISTS ix_ocr_voter_uploads_constituency_name ON ocr_voter_uploads (constituency_name)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ocr_voter_uploads_page_number ON ocr_voter_uploads (page_number)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ocr_voter_uploads_quality_flag ON ocr_voter_uploads (quality_flag)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ocr_voter_uploads_created_at ON ocr_voter_uploads (created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_ocr_voter_uploads_created_at")
    op.execute("DROP INDEX IF EXISTS ix_ocr_voter_uploads_quality_flag")
    op.execute("DROP INDEX IF EXISTS ix_ocr_voter_uploads_page_number")
    op.execute("DROP INDEX IF EXISTS ix_ocr_voter_uploads_constituency_name")
    op.execute("ALTER TABLE ocr_voter_uploads DROP COLUMN IF EXISTS quality_flag")
    op.execute("ALTER TABLE ocr_voter_uploads DROP COLUMN IF EXISTS epic_confidence")
    op.execute("ALTER TABLE ocr_voter_uploads DROP COLUMN IF EXISTS source_block")
    op.execute("ALTER TABLE ocr_voter_uploads DROP COLUMN IF EXISTS section_name")
    op.execute("ALTER TABLE ocr_voter_uploads DROP COLUMN IF EXISTS card_index")
    op.execute("ALTER TABLE ocr_voter_uploads DROP COLUMN IF EXISTS relation_type")
