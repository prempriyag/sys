"""Field validation result: status for sampled voters (Verified Correct / False Deletion / Suspicious Addition)."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, BigInteger, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database.connection import Base


class FieldValidationResult(Base):
    __tablename__ = "field_validation_results"

    id = Column(BigInteger, primary_key=True, index=True)
    match_result_id = Column(BigInteger, ForeignKey("voter_match_results.id"), nullable=False, index=True)
    # VERIFIED_CORRECT, FALSE_DELETION, SUSPICIOUS_ADDITION
    status = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
