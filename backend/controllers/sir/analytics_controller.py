from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from database.connection import get_db
from services.matching_engine import MatchingEngine
from services.kpi_engine import KPIEngine
from models.sir.booth import Booth
from models.sir.kpi import BoothKPI
from models.sir.match_result import MatchResult
from models.sir.voter import VoterPre
import random

router = APIRouter(prefix="/api/sir/analytics", tags=["SIR Analytics"])

@router.post("/run/{constituency_id}")
def run_analytics(constituency_id: int, db: Session = Depends(get_db)):
    """
    Run Advanced Analytics:
    1. Family Clustering (Anomaly Detection)
    2. Risk Scoring & KPI Calculation
    """
    try:
        # 1. Family Clustering
        matching_engine = MatchingEngine(db)
        anomaly_counts = matching_engine.analyze_families(constituency_id)
        
        # Update BoothKPIs with anomaly counts BEFORE running KPI engine risk logic
        for booth_id, count in anomaly_counts.items():
            kpi = db.query(BoothKPI).filter(BoothKPI.booth_id == booth_id).first()
            if not kpi:
                kpi = BoothKPI(booth_id=booth_id)
                db.add(kpi)
            kpi.anomaly_household_count = count
        
        db.commit()
        
        # 2. Risk Scoring & KPI Calculation
        kpi_engine = KPIEngine(db)
        kpi_engine.calculate_booth_kpis(constituency_id)
        
        return {"message": "Analytics run successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/high-risk/{constituency_id}")
def get_high_risk_booths(constituency_id: int, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get top 'High Risk' booths for field validation.
    Ordered by Deletion Velocity desc.
    """
    booths = db.query(Booth, BoothKPI)\
        .join(BoothKPI, Booth.id == BoothKPI.booth_id)\
        .filter(Booth.constituency_id == constituency_id)\
        .filter(BoothKPI.risk_category.in_(['HIGH_RISK', 'ANOMALY']))\
        .order_by(desc(BoothKPI.deletion_velocity))\
        .limit(limit)\
        .all()
        
    return [
        {
            "booth_number": b.Booth.booth_number,
            "location_name": b.Booth.location_name,
            "deletion_velocity": float(b.BoothKPI.deletion_velocity) if b.BoothKPI.deletion_velocity else 0.0,
            "risk_category": b.BoothKPI.risk_category,
            "anomaly_household_count": b.BoothKPI.anomaly_household_count or 0
        }
        for b in booths
    ]

@router.get("/validation-sample/{constituency_id}")
def get_validation_sample(constituency_id: int, sample_percent: float = 5.0, db: Session = Depends(get_db)):
    """
    Get random sample of 'Deleted' voters for field verification.
    """
    # Get all deleted voter IDs in this constituency
    # Join MatchResult -> VoterPre -> Booth
    deleted_query = db.query(VoterPre)\
        .join(MatchResult, MatchResult.pre_voter_id == VoterPre.id)\
        .join(Booth, VoterPre.booth_id == Booth.id)\
        .filter(Booth.constituency_id == constituency_id)\
        .filter(MatchResult.classification == 'DELETED')
        
    total_deleted = deleted_query.count()
    sample_size = int(total_deleted * (sample_percent / 100))
    
    # Random sampling logic (optimized for large datasets if needed, but simple Python random for now)
    # Fetching all IDs and sampling in Python might be heavy if millions, but likely okay for demo
    # Better: Use TABLESAMPLE in Postgres or random() order with limit
    
    sampled_voters = deleted_query.order_by(func.random()).limit(sample_size).all()
    
    return [
        {
            "epic_number": v.epic_number,
            "name": v.name,
            "relative_name": v.relative_name,
            "booth_id": v.booth_id,
            "age": v.age,
            "gender": v.gender
        }
        for v in sampled_voters
    ]
