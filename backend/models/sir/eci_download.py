"""
Schema for ECI download metadata.

Each time the automated downloader runs, we record the parameters (state, year, district,
assembly constituency, language) in `eci_downloads`. A separate table `eci_download_files` keeps
track of individual PDF files associated with a download along with a small batch code and status.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database.connection import Base


class EciDownload(Base):
    """Recording of a download request (parameters used for retrieval)."""

    __tablename__ = "eci_downloads"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(150), nullable=False, index=True)
    year_of_revision = Column(String(20), nullable=False, index=True)
    district = Column(String(150), nullable=False, index=True)
    assembly_constituency = Column(String(200), nullable=False, index=True)
    language = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String(255), nullable=True, index=True)


class EciDownloadFile(Base):
    """A file produced by a download. Batch is a 4–6 digit unique identifier."""

    __tablename__ = "eci_download_files"

    id = Column(Integer, primary_key=True, index=True)
    download_id = Column(Integer, ForeignKey("eci_downloads.id", ondelete="CASCADE"), nullable=False, index=True)
    batch = Column(String(10), nullable=False, unique=True, index=True)
    file_path = Column(String(1000), nullable=False)
    status = Column(String(50), nullable=False, server_default="pending")  # pending, completed, failed etc.
    created_at = Column(DateTime, server_default=func.now())
