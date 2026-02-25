"""Add eci_roll_selections table (state, year_of_revision, district, assembly_constituency)

Revision ID: add_eci_roll_selections
Revises: add_eci_master_tables
Create Date: ECI roll selection record

"""
from alembic import op
import sqlalchemy as sa


revision = "add_eci_roll_selections"
down_revision = "add_eci_master_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "eci_roll_selections",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("state", sa.String(150), nullable=False, index=True),
        sa.Column("year_of_revision", sa.String(20), nullable=False, index=True),
        sa.Column("district", sa.String(150), nullable=False, index=True),
        sa.Column("assembly_constituency", sa.String(200), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("eci_roll_selections")
