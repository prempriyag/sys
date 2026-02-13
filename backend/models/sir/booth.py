from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base

# For now, use separate lat/lng columns instead of PostGIS geometry
# This avoids requiring PostGIS extension installation
class Booth(Base):
    __tablename__ = "booths"

    id = Column(Integer, primary_key=True, index=True)
    constituency_id = Column(Integer, ForeignKey("constituencies.id"))
    booth_number = Column(String(20))
    location_name = Column(Text)
    # Use separate lat/lng columns instead of PostGIS geometry
    # Can be converted to geometry later if PostGIS is installed
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    turnout_percentage = Column(Numeric(5, 2), default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    constituency = relationship("Constituency", back_populates="booths")
    voters_pre = relationship("VoterPre", back_populates="booth")
    voters_post = relationship("VoterPost", back_populates="booth")
    kpi = relationship("BoothKPI", uselist=False, back_populates="booth")
