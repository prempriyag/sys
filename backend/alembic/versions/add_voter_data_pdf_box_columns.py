"""Add pdf_name, box_id, relation_type, confidence_score; unique (pdf_name, box_id)

Revision ID: voter_data_pdf_box
Revises: rename_to_voter_data
Create Date: 2026-02-26

"""
from alembic import op
import sqlalchemy as sa


revision = "voter_data_pdf_box"
down_revision = "rename_to_voter_data"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("voter_data", sa.Column("pdf_name", sa.String(255), nullable=True))
    op.add_column("voter_data", sa.Column("box_id", sa.Integer(), nullable=True))
    op.add_column("voter_data", sa.Column("relation_type", sa.String(20), nullable=True))
    op.add_column("voter_data", sa.Column("confidence_score", sa.Float(), nullable=True))
    op.create_index(op.f("ix_voter_data_pdf_name"), "voter_data", ["pdf_name"], unique=False)

    # Drop old unique on epic_number if present (so same EPIC can appear in different PDFs)
    op.execute("ALTER TABLE voter_data DROP CONSTRAINT IF EXISTS uq_voter_data_epic")
    op.create_unique_constraint("uq_voter_data_pdf_box", "voter_data", ["pdf_name", "box_id"])


def downgrade() -> None:
    op.drop_constraint("uq_voter_data_pdf_box", "voter_data", type_="unique")
    op.execute("ALTER TABLE voter_data ADD CONSTRAINT uq_voter_data_epic UNIQUE (epic_number)")
    op.drop_index(op.f("ix_voter_data_pdf_name"), table_name="voter_data")
    op.drop_column("voter_data", "confidence_score")
    op.drop_column("voter_data", "relation_type")
    op.drop_column("voter_data", "box_id")
    op.drop_column("voter_data", "pdf_name")
