"""Add epic_downloads and epic_voter_files tables

Revision ID: epic_downloads
Revises: electoral_roll_validation
Create Date: 2026-03-05

"""
from alembic import op
import sqlalchemy as sa

revision = "epic_downloads"
down_revision = "electoral_roll_validation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "epic_downloads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.String(10), nullable=False),
        sa.Column("state", sa.String(150), nullable=True),
        sa.Column("year", sa.String(20), nullable=True),
        sa.Column("role", sa.String(100), nullable=True),
        sa.Column("district", sa.String(150), nullable=True),
        sa.Column("constancy", sa.String(200), nullable=True),
        sa.Column("language", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="new"),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_by", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_epic_downloads_batch_id", "epic_downloads", ["batch_id"], unique=True)
    op.create_index("ix_epic_downloads_state", "epic_downloads", ["state"])
    op.create_index("ix_epic_downloads_status", "epic_downloads", ["status"])

    op.create_table(
        "epic_voter_files",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("downloaded_id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.String(10), nullable=False),
        sa.Column("file_path", sa.String(1000), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="new"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["downloaded_id"], ["epic_downloads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_epic_voter_files_downloaded_id", "epic_voter_files", ["downloaded_id"])
    op.create_index("ix_epic_voter_files_batch_id", "epic_voter_files", ["batch_id"])
    op.create_index("ix_epic_voter_files_status", "epic_voter_files", ["status"])


def downgrade() -> None:
    op.drop_index("ix_epic_voter_files_status", table_name="epic_voter_files")
    op.drop_index("ix_epic_voter_files_batch_id", table_name="epic_voter_files")
    op.drop_index("ix_epic_voter_files_downloaded_id", table_name="epic_voter_files")
    op.drop_table("epic_voter_files")
    op.drop_index("ix_epic_downloads_status", table_name="epic_downloads")
    op.drop_index("ix_epic_downloads_state", table_name="epic_downloads")
    op.drop_index("ix_epic_downloads_batch_id", table_name="epic_downloads")
    op.drop_table("epic_downloads")
