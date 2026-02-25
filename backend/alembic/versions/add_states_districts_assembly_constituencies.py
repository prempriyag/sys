"""Add states, districts, assembly_constituencies tables for ECI dropdowns

Revision ID: add_eci_master_tables
Revises: add_youth_bands
Create Date: ECI State / District / Assembly Constituency masters

"""
from alembic import op
import sqlalchemy as sa


revision = "add_eci_master_tables"
down_revision = "add_youth_bands"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "states",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(150), nullable=False, index=True, unique=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "districts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(150), nullable=False, index=True),
        sa.Column("state_id", sa.Integer(), sa.ForeignKey("states.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "assembly_constituencies",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False, index=True),
        sa.Column("district_id", sa.Integer(), sa.ForeignKey("districts.id"), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("assembly_constituencies")
    op.drop_table("districts")
    op.drop_table("states")
