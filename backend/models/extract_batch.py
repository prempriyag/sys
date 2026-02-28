"""
Automated File Processing - Extract Batch Module
Tables: extract_downloads, extract_headers, extract_lines
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger, Float
from sqlalchemy.sql import func
from database.connection import Base


class ExtractDownload(Base):
    """
    File-level metadata for each processed document.
    One row per file; batch_id links to headers and lines.
    """
    __tablename__ = "extract_downloads"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(5), nullable=False, unique=True, index=True)  # 5-digit identifier
    original_file_name = Column(String(500), nullable=False)
    file_created_datetime = Column(DateTime, nullable=True)  # File creation timestamp
    total_pages = Column(Integer, nullable=True)
    stored_path = Column(String(1000), nullable=True)  # Archive path for reprocessing
    created_at = Column(DateTime, server_default=func.now())


class ExtractHeader(Base):
    """
    Header-level data extracted from the document.
    Linked to extract_downloads via batch_id.
    """
    __tablename__ = "extract_headers"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(5), nullable=False, index=True)
    header_key = Column(String(200), nullable=False)  # e.g. constituency_name, part_no
    header_value = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ExtractLine(Base):
    """
    Line-item data (voter records) extracted from the document.
    Linked to extract_downloads via batch_id.
    """
    __tablename__ = "extract_lines"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(5), nullable=False, index=True)
    line_number = Column(Integer, nullable=True)  # Ordinal within batch
    page_number = Column(Integer, nullable=True)
    epic_number = Column(String(20), nullable=True, index=True)
    name = Column(String(255), nullable=True)
    relative_name = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(10), nullable=True)
    house_no = Column(String(200), nullable=True)
    address = Column(Text, nullable=True)
    booth_number = Column(String(50), nullable=True)
    constituency_name = Column(String(200), nullable=True)
    confidence_score = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
