from sqlalchemy import Column, Integer, String
from database.connection import Base
from config.constants import TBL_SMTP

class PortalSMTP(Base):
    __tablename__ = TBL_SMTP

    id = Column(Integer, primary_key=True, index=True)
    host = Column(String(255))
    username = Column(String(255))
    password = Column(String(255))
    port = Column(String(50))
