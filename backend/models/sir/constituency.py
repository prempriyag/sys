from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base

class Constituency(Base):
    __tablename__ = "constituencies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), index=True)
    district = Column(String(150))
    state = Column(String(100))
    created_at = Column(DateTime, server_default=func.now())

    booths = relationship("Booth", back_populates="constituency")
