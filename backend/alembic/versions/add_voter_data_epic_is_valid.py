"""Add epic_is_valid to voter_data (store all EPICs; flag invalid)

Revision ID: voter_data_epic_is_valid
Revises: voter_data_pdf_box
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa


revision = "voter_data_epic_is_valid"
down_revision = "voter_data_pdf_box"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "voter_data",
        sa.Column("epic_is_valid", sa.Boolean(), nullable=True, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("voter_data", "epic_is_valid")
