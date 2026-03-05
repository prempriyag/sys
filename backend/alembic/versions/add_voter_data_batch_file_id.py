"""Add batch_id and file_id to voter_data for epic extraction reference

Revision ID: voter_data_batch_file
Revises: epic_downloads
Create Date: 2026-03-05

"""
from alembic import op
import sqlalchemy as sa

revision = "voter_data_batch_file"
down_revision = "epic_downloads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "voter_data",
        sa.Column("batch_id", sa.String(20), nullable=True),
    )
    op.add_column(
        "voter_data",
        sa.Column("file_id", sa.Integer(), nullable=True),
    )
    op.create_index("ix_voter_data_batch_id", "voter_data", ["batch_id"])
    op.create_index("ix_voter_data_file_id", "voter_data", ["file_id"])


def downgrade() -> None:
    op.drop_index("ix_voter_data_file_id", table_name="voter_data")
    op.drop_index("ix_voter_data_batch_id", table_name="voter_data")
    op.drop_column("voter_data", "file_id")
    op.drop_column("voter_data", "batch_id")
