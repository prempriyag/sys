"""
Bulk Electoral Roll import: one row per voter box; unique per (pdf_name, box_id).
Used by /upload/bulk-electoral-roll and pdf_folder_extractor (production flow).
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, Numeric, Float, Boolean, UniqueConstraint
from sqlalchemy.sql import func
from database.connection import Base


class BulkVoterImport(Base):
    __tablename__ = "voter_data"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    pdf_name = Column(String(255), nullable=True, index=True)
    page_number = Column(Integer, nullable=True)
    box_id = Column(Integer, nullable=True)  # unique per PDF (1, 2, 3...)

    epic_number = Column(String(20), nullable=True, index=True)  # 3–4 letters + 6–7 digits
    epic_is_valid = Column(Boolean, default=True, nullable=True)  # False when format invalid or missing (stored, not dropped)
    name = Column(String(255), nullable=True)
    relative_name = Column(String(255), nullable=True)
    relation_type = Column(String(20), nullable=True)  # Father/Husband etc
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)

    house_no = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    constituency_name = Column(String(200), nullable=True)
    year = Column(String(20), nullable=True)
    booth_number = Column(String(50), nullable=True)
    source_pdf = Column(String(500), nullable=True)

    confidence_score = Column(Float, nullable=True)
    confidence = Column(Numeric(5, 4), nullable=True)  # legacy
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("pdf_name", "box_id", name="uq_voter_data_pdf_box"),
    )
