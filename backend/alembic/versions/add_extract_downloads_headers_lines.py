"""Add extract_downloads, extract_headers, extract_lines tables

Revision ID: extract_batch
Revises: voter_data_pdf_box
Create Date: 2026-02-26

"""
from alembic import op
import sqlalchemy as sa

revision = "extract_batch"
down_revision = "voter_data_pdf_box"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "extract_downloads",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.String(5), nullable=False),
        sa.Column("original_file_name", sa.String(500), nullable=False),
        sa.Column("file_created_datetime", sa.DateTime(), nullable=True),
        sa.Column("total_pages", sa.Integer(), nullable=True),
        sa.Column("stored_path", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extract_downloads_batch_id", "extract_downloads", ["batch_id"], unique=True)

    op.create_table(
        "extract_headers",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.String(5), nullable=False),
        sa.Column("header_key", sa.String(200), nullable=False),
        sa.Column("header_value", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extract_headers_batch_id", "extract_headers", ["batch_id"])

    op.create_table(
        "extract_lines",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("batch_id", sa.String(5), nullable=False),
        sa.Column("line_number", sa.Integer(), nullable=True),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("epic_number", sa.String(20), nullable=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("relative_name", sa.String(255), nullable=True),
        sa.Column("age", sa.Integer(), nullable=True),
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("house_no", sa.String(200), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("booth_number", sa.String(50), nullable=True),
        sa.Column("constituency_name", sa.String(200), nullable=True),
        sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_extract_lines_batch_id", "extract_lines", ["batch_id"])
    op.create_index("ix_extract_lines_epic_number", "extract_lines", ["epic_number"])


def downgrade() -> None:
    op.drop_index("ix_extract_lines_epic_number", table_name="extract_lines")
    op.drop_index("ix_extract_lines_batch_id", table_name="extract_lines")
    op.drop_table("extract_lines")
    op.drop_index("ix_extract_headers_batch_id", table_name="extract_headers")
    op.drop_table("extract_headers")
    op.drop_index("ix_extract_downloads_batch_id", table_name="extract_downloads")
    op.drop_table("extract_downloads")
