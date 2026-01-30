"""
Permission model - corresponds to PORTAL_PERMISSIONS table
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database.connection import Base
from config.constants import TBL_PERMISSIONS


class Permission(Base):
    """Permission model - corresponds to PORTAL_PERMISSIONS table"""
    __tablename__ = TBL_PERMISSIONS
    
    ID = Column(Integer, primary_key=True, index=True)
    PERMISSION_KEY = Column(String(255), unique=True, index=True)
    PERMISSION_NAME = Column(String(255))
    TYPE = Column(String(255))  # 'parent' or parent ID
    DESCRIPTION = Column(String(500), nullable=True)
    
    role_permissions = relationship("RolePermission", back_populates="permission")

