"""Add language to eci_roll_selections

Revision ID: add_eci_roll_language
Revises: add_eci_roll_created_by_pdf
Create Date: ECI roll selection language

"""
from alembic import op
import sqlalchemy as sa


revision = "add_eci_roll_language"
down_revision = "add_eci_roll_created_by_pdf"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eci_roll_selections", sa.Column("language", sa.String(100), nullable=True))
    op.create_index("ix_eci_roll_selections_language", "eci_roll_selections", ["language"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_eci_roll_selections_language", table_name="eci_roll_selections")
    op.drop_column("eci_roll_selections", "language")
