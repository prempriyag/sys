"""
User model - corresponds to PORTAL_ADMIN table
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.connection import Base
from config.constants import TBL_ADMIN, TBL_ROLES


class User(Base):
    """User model - corresponds to PORTAL_ADMIN table"""
    __tablename__ = TBL_ADMIN
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    password = Column(String(255))
    role_id = Column(Integer, ForeignKey(f"{TBL_ROLES}.ID"))
    status = Column(Integer, default=1)  # 0=Inactive, 1=Active, 2=Blocked
    college_perm = Column(Integer, default=0)
    hs_perm = Column(Integer, default=0)
    ocr_perm = Column(Integer, default=0)
    last_login = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    created_by = Column(String(255))
    updated_at = Column(DateTime, onupdate=func.now())
    updated_by = Column(String(255))
    object_id = Column(String(255), nullable=True)
    
    role = relationship("Role", back_populates="users")

