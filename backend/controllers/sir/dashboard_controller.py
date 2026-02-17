from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.booth import Booth
from models.sir.kpi import BoothKPI
from models.sir.constituency import Constituency
from models.sir.voter import VoterPre, VoterPost
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/sir/dashboard",
    tags=["SIR Dashboard"]
)

@router.get("/constituencies")
async def get_constituencies(db: Session = Depends(get_db)):
    """Get list of all constituencies"""
    try:
        constituencies = db.query(Constituency).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "district": c.district,
                "state": c.state
            }
            for c in constituencies
        ]
    except Exception as e:
        logger.exception(f"Error fetching constituencies: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching constituencies: {str(e)}"
        )

@router.get("/risk-map/{constituency_id}")
async def get_risk_map(constituency_id: int, db: Session = Depends(get_db)):
    """
    Get booth locations and risk status for heatmap/risk map.
    Returns data for Leaflet map visualization.
    """
    try:
        # Query booths with lat/lng columns (no PostGIS required)
        booths = db.query(
            Booth.id,
            Booth.booth_number,
            Booth.location_name,
            Booth.latitude,
            Booth.longitude,
            BoothKPI.risk_category,
            BoothKPI.deletion_velocity,
            BoothKPI.net_change_percent
        ).outerjoin(BoothKPI, Booth.id == BoothKPI.booth_id)\
         .filter(Booth.constituency_id == constituency_id)\
         .all()
        
        return [
            {
                "booth_id": b.id,
                "booth_number": b.booth_number,
                "location_name": b.location_name,
                "risk_category": b.risk_category or "NORMAL",
                "deletion_velocity": float(b.deletion_velocity) if b.deletion_velocity else 0.0,
                "net_change_percent": float(b.net_change_percent) if b.net_change_percent else 0.0,
                "lat": float(b.latitude) if b.latitude is not None else None,
                "lng": float(b.longitude) if b.longitude is not None else None
            }
            for b in booths
        ]
    except Exception as e:
        # Log the error and return empty list
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error fetching risk map data: {str(e)}")
        return []


@router.get("/roll-summary")
async def get_roll_summary(db: Session = Depends(get_db)):
    """
    Summary of uploaded roll data (before or after matching).
    Shows how many Pre-SIR and Post-SIR voters are stored per constituency and per booth.
    Use this to verify that your uploads were stored correctly.
    """
    try:
        constituencies = db.query(Constituency).order_by(Constituency.name).all()
        result = []
        for c in constituencies:
            booths = db.query(Booth).filter(Booth.constituency_id == c.id).order_by(Booth.booth_number).all()
            booth_summaries = []
            total_pre = 0
            total_post = 0
            for b in booths:
                pre_count = db.query(func.count(VoterPre.id)).filter(VoterPre.booth_id == b.id).scalar() or 0
                post_count = db.query(func.count(VoterPost.id)).filter(VoterPost.booth_id == b.id).scalar() or 0
                total_pre += pre_count
                total_post += post_count
                booth_summaries.append({
                    "booth_id": b.id,
                    "booth_number": b.booth_number,
                    "location_name": b.location_name or "",
                    "pre_sir_count": pre_count,
                    "post_sir_count": post_count,
                })
            result.append({
                "constituency_id": c.id,
                "constituency_name": c.name,
                "district": c.district,
                "state": c.state,
                "total_pre_sir": total_pre,
                "total_post_sir": total_post,
                "booths": booth_summaries,
            })
        return result
    except Exception as e:
        logger.exception(f"Error fetching roll summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/roll-sample")
async def get_roll_sample(
    constituency_id: int = Query(..., description="Constituency ID"),
    roll: str = Query("pre", description="'pre' or 'post'"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """
    Sample of uploaded voter records for a constituency (to verify extracted data).
    """
    if roll not in ("pre", "post"):
        raise HTTPException(status_code=400, detail="roll must be 'pre' or 'post'")
    try:
        booths = db.query(Booth.id).filter(Booth.constituency_id == constituency_id).all()
        booth_ids = [b.id for b in booths]
        if not booth_ids:
            return []
        model = VoterPre if roll == "pre" else VoterPost
        rows = (
            db.query(model)
            .filter(model.booth_id.in_(booth_ids))
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "epic_number": r.epic_number,
                "name": r.name,
                "relative_name": r.relative_name,
                "age": r.age,
                "gender": r.gender,
                "house_no": r.house_no,
                "address": (r.address or "")[:100] + ("..." if (r.address or "") and len(r.address or "") > 100 else ""),
            }
            for r in rows
        ]
    except Exception as e:
        logger.exception(f"Error fetching roll sample: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
