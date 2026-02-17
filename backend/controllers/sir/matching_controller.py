from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services.matching_engine import MatchingEngine
from services.kpi_engine import KPIEngine

router = APIRouter(
    prefix="/api/matching",
    tags=["Matching"]
)

@router.post("/run/{constituency_id}")
async def run_matching(constituency_id: int, db: Session = Depends(get_db)):
    """
    Run matching algorithm for a constituency.
    This will:
    1. Match Pre-SIR and Post-SIR voters
    2. Classify voters (UNCHANGED, ADDED, DELETED, MODIFIED, MIGRATED)
    3. Calculate KPIs for all booths
    """
    try:
        # Run matching
        matching_engine = MatchingEngine(db)
        match_count = matching_engine.run_matching(constituency_id)
        
        # Calculate KPIs after matching
        kpi_engine = KPIEngine(db)
        kpi_engine.calculate_booth_kpis(constituency_id)
        
        return {
            "message": "Matching Process Completed Successfully",
            "matches_created": match_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error running matching: {str(e)}")
