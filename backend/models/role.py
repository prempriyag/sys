"""
Role model - corresponds to PORTAL_ROLES table
"""
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from database.connection import Base
from config.constants import TBL_ROLES


class Role(Base):
    """Role model - corresponds to PORTAL_ROLES table"""
    __tablename__ = TBL_ROLES
    
    ID = Column(Integer, primary_key=True, index=True)
    ROLE_NAME = Column(String(255))
    ROLE_KEY = Column(String(255))
    
    users = relationship("User", back_populates="role")
    role_permissions = relationship("RolePermission", back_populates="role")

