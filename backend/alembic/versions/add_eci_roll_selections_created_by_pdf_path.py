"""Add created_by and pdf_path to eci_roll_selections

Revision ID: add_eci_roll_created_by_pdf
Revises: add_eci_roll_selections
Create Date: ECI roll selection created_by, pdf_path

"""
from alembic import op
import sqlalchemy as sa


revision = "add_eci_roll_created_by_pdf"
down_revision = "add_eci_roll_selections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eci_roll_selections", sa.Column("created_by", sa.String(255), nullable=True))
    op.add_column("eci_roll_selections", sa.Column("pdf_path", sa.String(1000), nullable=True))
    op.create_index("ix_eci_roll_selections_created_by", "eci_roll_selections", ["created_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_eci_roll_selections_created_by", table_name="eci_roll_selections")
    op.drop_column("eci_roll_selections", "pdf_path")
    op.drop_column("eci_roll_selections", "created_by")
