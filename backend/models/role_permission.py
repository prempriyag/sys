"""
Role Permission model - corresponds to PORTAL_ROLE_PERMISSIONS table
"""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database.connection import Base
from config.constants import TBL_ROLE_PERMISSIONS, TBL_ROLES, TBL_PERMISSIONS


class RolePermission(Base):
    """Role Permission model - corresponds to PORTAL_ROLE_PERMISSIONS table"""
    __tablename__ = TBL_ROLE_PERMISSIONS
    
    ID = Column(Integer, primary_key=True, index=True)
    ROLE_ID = Column(Integer, ForeignKey(f"{TBL_ROLES}.ID"))
    PERMISSION_ID = Column(Integer, ForeignKey(f"{TBL_PERMISSIONS}.ID"))
    ADD = Column(Integer, default=0)  # 0 or 1
    VIEW = Column(Integer, default=0)  # 0 or 1
    UPDATE = Column(Integer, default=0)  # 0 or 1
    DELETE = Column(Integer, default=0)  # 0 or 1
    
    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

