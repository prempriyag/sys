"""Add risk_score to booth_kpis (fix KPI API column missing)

Revision ID: add_risk_score
Revises: add_youth_bands
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "add_risk_score"
down_revision = "add_youth_bands"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL: ADD COLUMN IF NOT EXISTS (idempotent)
    op.execute("""
        ALTER TABLE booth_kpis
        ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5,2) DEFAULT 0.0
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE booth_kpis DROP COLUMN IF EXISTS risk_score")
