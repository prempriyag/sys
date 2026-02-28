"""Add electoral_roll_metadata table (page-1 summary per PDF)

Revision ID: electoral_roll_metadata
Revises: voter_data_epic_is_valid
Create Date: 2026-02-28

"""
from alembic import op
import sqlalchemy as sa


revision = "electoral_roll_metadata"
down_revision = "voter_data_epic_is_valid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "electoral_roll_metadata",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("pdf_name", sa.String(255), nullable=False),
        sa.Column("state", sa.String(100), nullable=True),
        sa.Column("district", sa.String(150), nullable=True),
        sa.Column("assembly_no", sa.String(20), nullable=True),
        sa.Column("assembly_name", sa.String(150), nullable=True),
        sa.Column("parliament_constituency", sa.String(200), nullable=True),
        sa.Column("part_number", sa.String(20), nullable=True),
        sa.Column("year", sa.String(20), nullable=True),
        sa.Column("total_electors", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_electoral_roll_metadata_pdf_name"), "electoral_roll_metadata", ["pdf_name"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_electoral_roll_metadata_pdf_name"), table_name="electoral_roll_metadata")
    op.drop_table("electoral_roll_metadata")
