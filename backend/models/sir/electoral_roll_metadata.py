"""
Electoral roll PDF metadata extracted from page 1 (cover/summary).
One row per PDF: state, district, assembly, part, year, total_electors.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, Boolean
from sqlalchemy.sql import func
from database.connection import Base


class ElectoralRollMetadata(Base):
    __tablename__ = "electoral_roll_metadata"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    pdf_name = Column(String(255), nullable=False, index=True, unique=True)

    state = Column(String(100), nullable=True)
    district = Column(String(150), nullable=True)
    assembly_no = Column(String(20), nullable=True)
    assembly_name = Column(String(150), nullable=True)
    parliament_constituency = Column(String(200), nullable=True)
    part_number = Column(String(20), nullable=True)
    year = Column(String(20), nullable=True)
    total_electors = Column(Integer, nullable=True)
    extracted_count = Column(Integer, nullable=True)  # count of records extracted from PDF
    count_matches_summary = Column(Boolean, nullable=True)  # True when extracted_count == page-1 total

    created_at = Column(DateTime, server_default=func.now())
