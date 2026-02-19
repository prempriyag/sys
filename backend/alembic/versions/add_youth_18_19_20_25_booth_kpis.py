"""Add youth_18_19_percent and youth_20_25_percent to booth_kpis (SOP 5.1)

Revision ID: add_youth_bands
Revises: None
Create Date: SOP 5.1 Youth Intake age bands

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "add_youth_bands"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("booth_kpis", sa.Column("youth_18_19_percent", sa.Numeric(5, 2), server_default="0", nullable=True))
    op.add_column("booth_kpis", sa.Column("youth_20_25_percent", sa.Numeric(5, 2), server_default="0", nullable=True))


def downgrade() -> None:
    op.drop_column("booth_kpis", "youth_20_25_percent")
    op.drop_column("booth_kpis", "youth_18_19_percent")
