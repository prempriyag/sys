"""Add year column to bulk_voter_import (constituency_name already exists)

Revision ID: bulk_voter_year
Revises: bulk_voter
Create Date: 2026-02-26

"""
from alembic import op
import sqlalchemy as sa


revision = "bulk_voter_year"
down_revision = "bulk_voter"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bulk_voter_import", sa.Column("year", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("bulk_voter_import", "year")
