"""
Stores voter records extracted via OCR PDF Detector (/upload/ocr-pdf-detector).
Data is uploaded from the UI after extraction for persistence in the sys database.
Schema optimized for ~7 lakh (700k) records: indexes on epic_number, page_number,
quality_flag, constituency_name, created_at for fast filters and bulk uploads.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, Numeric
from sqlalchemy.sql import func
from database.connection import Base


class OcrVoterUpload(Base):
    __tablename__ = "ocr_voter_uploads"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    # Voter fields (match extractor + strict CSV)
    epic_number = Column(String(50), index=True, nullable=True)
    name = Column(Text, nullable=True)
    relative_name = Column(Text, nullable=True)
    relation_type = Column(String(20), nullable=True)  # Father/Husband/Mother
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)
    house_no = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    booth_number = Column(String(50), nullable=True)
    constituency_name = Column(String(200), index=True, nullable=True)
    page_number = Column(Integer, index=True, nullable=True)
    card_index = Column(Integer, nullable=True)  # 0-based card index on page
    section_name = Column(String(200), nullable=True)
    source_block = Column(Text, nullable=True)  # raw block id / debug
    # Quality and confidence (strict-style)
    confidence = Column(Numeric(5, 4), nullable=True)  # 0–1 overall
    epic_confidence = Column(Numeric(5, 4), nullable=True)  # 0–1 EPIC only
    quality_flag = Column(String(20), index=True, nullable=True)  # ok | review
    created_at = Column(DateTime, server_default=func.now(), index=True)
