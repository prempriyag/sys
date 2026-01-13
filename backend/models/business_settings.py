"""
Business settings model - corresponds to BUSINESS_SETTINGS table
"""
from sqlalchemy import Column, Integer, String
from database.connection import Base
from config.constants import TBL_BUSINESS


class BusinessSettings(Base):
    """Business settings model - corresponds to BUSINESS_SETTINGS table"""
    __tablename__ = TBL_BUSINESS
    
    ID = Column(Integer, primary_key=True, index=True)
    KEYCODE = Column(String(255), unique=True, index=True)
    KEYVALUE = Column(String(500))
    # Note: CREATED_ON and UPDATED_ON columns don't exist in the actual database table

