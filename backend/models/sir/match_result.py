from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger, Numeric
from sqlalchemy.sql import func
from database.connection import Base

class MatchResult(Base):
    __tablename__ = "voter_match_results"

    id = Column(BigInteger, primary_key=True, index=True)
    pre_voter_id = Column(BigInteger, ForeignKey("voters_pre_sir.id"), nullable=True)
    post_voter_id = Column(BigInteger, ForeignKey("voters_post_sir.id"), nullable=True)
    classification = Column(String(50)) # UNCHANGED, MODIFIED, MIGRATED, ADDED, DELETED
    match_score = Column(Numeric(5, 2))
    created_at = Column(DateTime, server_default=func.now())
