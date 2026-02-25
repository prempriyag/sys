"""
Stores voter records extracted via OCR PDF Detector (/upload/ocr-pdf-detector).
Data is uploaded from the UI after extraction for persistence in the sys database.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, Numeric
from sqlalchemy.sql import func
from database.connection import Base


class OcrVoterUpload(Base):
    __tablename__ = "ocr_voter_uploads"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    # Voter fields (match extractor output)
    epic_number = Column(String(50), index=True, nullable=True)
    name = Column(Text, nullable=True)
    relative_name = Column(Text, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)
    house_no = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    booth_number = Column(String(50), nullable=True)
    constituency_name = Column(String(200), nullable=True)
    page_number = Column(Integer, nullable=True)
    confidence = Column(Numeric(5, 4), nullable=True)  # 0–1
    created_at = Column(DateTime, server_default=func.now())
