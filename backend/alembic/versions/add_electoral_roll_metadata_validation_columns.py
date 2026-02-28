"""Add extracted_count and count_matches_summary to electoral_roll_metadata (cross-check totals)

Revision ID: electoral_roll_validation
Revises: electoral_roll_metadata
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa


revision = "electoral_roll_validation"
down_revision = "electoral_roll_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "electoral_roll_metadata",
        sa.Column("extracted_count", sa.Integer(), nullable=True),
    )
    op.add_column(
        "electoral_roll_metadata",
        sa.Column("count_matches_summary", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("electoral_roll_metadata", "count_matches_summary")
    op.drop_column("electoral_roll_metadata", "extracted_count")
