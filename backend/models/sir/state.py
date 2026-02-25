from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base


class State(Base):
    """State master for ECI dropdown (e.g. Tamil Nadu, Karnataka)."""
    __tablename__ = "states"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, server_default=func.now())

    districts = relationship("District", back_populates="state", cascade="all, delete-orphan")
