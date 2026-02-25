from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base


class District(Base):
    """District master under a state for ECI dropdown."""
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    state_id = Column(Integer, ForeignKey("states.id"), nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    state = relationship("State", back_populates="districts")
    assembly_constituencies = relationship(
        "AssemblyConstituency",
        back_populates="district",
        cascade="all, delete-orphan",
    )
