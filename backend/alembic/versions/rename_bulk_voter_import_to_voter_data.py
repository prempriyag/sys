"""Rename table bulk_voter_import to voter_data

Revision ID: rename_to_voter_data
Revises: bulk_voter_year
Create Date: 2026-02-26

"""
from alembic import op


revision = "rename_to_voter_data"
down_revision = "bulk_voter_year"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("bulk_voter_import", "voter_data")
    # Rename the unique index to match new table name
    op.execute("ALTER INDEX ix_bulk_voter_import_epic_number RENAME TO ix_voter_data_epic_number")
    # Rename constraint if it exists (PostgreSQL keeps constraint name)
    op.execute("ALTER TABLE voter_data RENAME CONSTRAINT uq_bulk_voter_import_epic TO uq_voter_data_epic")


def downgrade() -> None:
    op.execute("ALTER TABLE voter_data RENAME CONSTRAINT uq_voter_data_epic TO uq_bulk_voter_import_epic")
    op.execute("ALTER INDEX ix_voter_data_epic_number RENAME TO ix_bulk_voter_import_epic_number")
    op.rename_table("voter_data", "bulk_voter_import")
