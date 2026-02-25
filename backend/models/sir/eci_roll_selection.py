"""
ECI roll selection: State, Year of Revision, District, Assembly Constituency.
Stores one row per ECI form selection (state + year + district + assembly constituency).
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from database.connection import Base


class EciRollSelection(Base):
    """Stores ECI form selection: state, year of revision, district, assembly constituency, created_by, pdf_path."""

    __tablename__ = "eci_roll_selections"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String(150), nullable=False, index=True)
    year_of_revision = Column(String(20), nullable=False, index=True)  # e.g. 2024, 2025, 2026
    district = Column(String(150), nullable=False, index=True)
    assembly_constituency = Column(String(200), nullable=False, index=True)
    language = Column(String(100), nullable=True, index=True)  # e.g. English, Tamil, Kannada
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String(255), nullable=True, index=True)  # username or user identifier
    pdf_path = Column(String(1000), nullable=True)  # path to downloaded PDF
