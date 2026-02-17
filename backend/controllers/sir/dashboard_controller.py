from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.booth import Booth
from models.sir.kpi import BoothKPI
from models.sir.constituency import Constituency
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
