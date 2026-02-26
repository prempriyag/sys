"""Add bulk_voter_import table (EPIC UNIQUE, for bulk electoral roll)

Revision ID: bulk_voter
Revises: ocr_7lakh
Create Date: 2026-02-19

"""
from alembic import op
import sqlalchemy as sa


revision = "bulk_voter"
down_revision = "ocr_7lakh"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "bulk_voter_import",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("epic_number", sa.String(20), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("relative_name", sa.Text(), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("house_no", sa.String(200), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("constituency_name", sa.String(200), nullable=True),
        sa.Column("booth_number", sa.String(50), nullable=True),
        sa.Column("source_pdf", sa.String(500), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Numeric(5, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_bulk_voter_import_epic_number", "bulk_voter_import", ["epic_number"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_bulk_voter_import_epic_number", table_name="bulk_voter_import")
    op.drop_table("bulk_voter_import")
