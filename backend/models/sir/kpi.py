from sqlalchemy import Column, Integer, String, ForeignKey, Numeric
from sqlalchemy.orm import relationship
from database.connection import Base

class BoothKPI(Base):
    __tablename__ = "booth_kpis"

    booth_id = Column(Integer, ForeignKey("booths.id"), primary_key=True)
    total_pre = Column(Integer, default=0)
    total_post = Column(Integer, default=0)
    additions = Column(Integer, default=0)
    deletions = Column(Integer, default=0)
    net_change_percent = Column(Numeric(5, 2), default=0.0)
    deletion_velocity = Column(Numeric(5, 2), default=0.0)
    youth_intake_percent = Column(Numeric(5, 2), default=0.0)
    gender_shift_percent = Column(Numeric(5, 2), default=0.0)
    anomaly_household_count = Column(Integer, default=0) # Count of households > 15 voters
    risk_category = Column(String(50)) # HIGH_RISK, HIGH_OPPORTUNITY, ANOMALY, NORMAL
    risk_score = Column(Numeric(5, 2), default=0.0)  # 0-100 political risk scale

    booth = relationship("Booth", back_populates="kpi")
