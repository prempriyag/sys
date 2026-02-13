from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base

class VoterBase:
    id = Column(BigInteger, primary_key=True, index=True)
    epic_number = Column(String(50), index=True)
    name = Column(Text)
    relative_name = Column(Text)
    age = Column(Integer)
    gender = Column(String(10))
    house_no = Column(String(100))
    address = Column(Text)
    normalized_name = Column(Text)
    normalized_address = Column(Text)

class VoterPre(Base, VoterBase):
    __tablename__ = "voters_pre_sir"
    
    booth_id = Column(Integer, ForeignKey("booths.id"))
    booth = relationship("Booth", back_populates="voters_pre")

class VoterPost(Base, VoterBase):
    __tablename__ = "voters_post_sir"
    
    booth_id = Column(Integer, ForeignKey("booths.id"))
    booth = relationship("Booth", back_populates="voters_post")
