"""
Schema for Epic download metadata (epic_downloads, epic_voter_files).

Before executing download script: insert record in epic_downloads.
After download: extract file names and store in epic_voter_files.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from database.connection import Base


class EpicDownload(Base):
    """Recording of a download batch. Batch_Id is 5-digit unique auto-incremented."""

    __tablename__ = "epic_downloads"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(10), nullable=False, unique=True, index=True)  # 5-digit unique
    state = Column(String(150), nullable=True, index=True)
    year = Column(String(20), nullable=True, index=True)
    role = Column(String(100), nullable=True, index=True)
    district = Column(String(150), nullable=True, index=True)
    constancy = Column(String(200), nullable=True, index=True)  # assembly constituency
    language = Column(String(100), nullable=True, index=True)
    status = Column(String(50), nullable=False, server_default="new", index=True)
    created_by = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_by = Column(String(255), nullable=True, index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class EpicVoterFile(Base):
    """A file in a download batch. File path: download/processed/state/year/role/district/constancy/filename.pdf"""

    __tablename__ = "epic_voter_files"

    id = Column(Integer, primary_key=True, index=True)
    downloaded_id = Column(Integer, ForeignKey("epic_downloads.id", ondelete="CASCADE"), nullable=False, index=True)
    batch_id = Column(String(10), nullable=False, index=True)  # same as parent for convenience
    file_path = Column(String(1000), nullable=False)
    status = Column(String(50), nullable=False, server_default="new", index=True)  # new, extracted
    created_at = Column(DateTime, server_default=func.now())
