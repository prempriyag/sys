from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base


class AssemblyConstituency(Base):
    """Assembly Constituency master under a district for ECI dropdown."""
    __tablename__ = "assembly_constituencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    district = relationship("District", back_populates="assembly_constituencies")
