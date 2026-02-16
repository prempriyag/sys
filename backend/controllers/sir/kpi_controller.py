from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from models.sir.kpi import BoothKPI
from models.sir.booth import Booth
from services.kpi_engine import KPIEngine

router = APIRouter(
    prefix="/api/kpi",
    tags=["KPI"]
)

@router.get("/booth/{booth_id}")
async def get_booth_kpi(booth_id: int, db: Session = Depends(get_db)):
    """Get KPI data for a specific booth"""
    kpi = db.query(BoothKPI).filter(BoothKPI.booth_id == booth_id).first()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI data not found for this booth")
    
    return {
        "booth_id": kpi.booth_id,
        "total_pre": kpi.total_pre,
        "total_post": kpi.total_post,
        "additions": kpi.additions,
        "deletions": kpi.deletions,
        "net_change_percent": float(kpi.net_change_percent) if kpi.net_change_percent else 0.0,
        "deletion_velocity": float(kpi.deletion_velocity) if kpi.deletion_velocity else 0.0,
        "youth_intake_percent": float(kpi.youth_intake_percent) if kpi.youth_intake_percent else 0.0,
        "youth_18_19_percent": float(getattr(kpi, "youth_18_19_percent", None) or 0),
        "youth_20_25_percent": float(getattr(kpi, "youth_20_25_percent", None) or 0),
        "gender_shift_percent": float(kpi.gender_shift_percent) if kpi.gender_shift_percent else 0.0,
        "anomaly_household_count": kpi.anomaly_household_count,
        "risk_category": kpi.risk_category
    }

@router.get("/constituency/{constituency_id}")
async def get_constituency_kpi(constituency_id: int, db: Session = Depends(get_db)):
    """Get aggregated KPI data for all booths in a constituency"""
    kpis = db.query(BoothKPI).join(Booth).filter(Booth.constituency_id == constituency_id).all()
    
    if not kpis:
        return {
            "total_pre": 0,
            "total_post": 0,
            "total_additions": 0,
            "total_deletions": 0,
        "avg_net_change_percent": 0.0,
        "avg_deletion_velocity": 0.0,
        "avg_youth_intake_percent": 0.0,
        "avg_youth_18_19_percent": 0.0,
        "avg_youth_20_25_percent": 0.0,
        "avg_gender_shift_percent": 0.0,
            "total_anomaly_households": 0,
            "high_risk_booths": 0,
            "high_opportunity_booths": 0,
            "anomaly_booths": 0
        }
    
    total_pre = sum(k.total_pre for k in kpis)
    total_post = sum(k.total_post for k in kpis)
    total_additions = sum(k.additions for k in kpis)
    total_deletions = sum(k.deletions for k in kpis)
    total_anomaly_households = sum(k.anomaly_household_count for k in kpis)
    
    avg_net_change_percent = sum(float(k.net_change_percent or 0) for k in kpis) / len(kpis) if kpis else 0.0
    avg_deletion_velocity = sum(float(k.deletion_velocity or 0) for k in kpis) / len(kpis) if kpis else 0.0
    avg_youth_intake_percent = sum(float(k.youth_intake_percent or 0) for k in kpis) / len(kpis) if kpis else 0.0
    avg_youth_18_19_percent = sum(float(getattr(k, "youth_18_19_percent", None) or 0) for k in kpis) / len(kpis) if kpis else 0.0
    avg_youth_20_25_percent = sum(float(getattr(k, "youth_20_25_percent", None) or 0) for k in kpis) / len(kpis) if kpis else 0.0
    avg_gender_shift_percent = sum(float(k.gender_shift_percent or 0) for k in kpis) / len(kpis) if kpis else 0.0
    
    high_risk_booths = sum(1 for k in kpis if k.risk_category == "HIGH_RISK")
    high_opportunity_booths = sum(1 for k in kpis if k.risk_category == "HIGH_OPPORTUNITY")
    anomaly_booths = sum(1 for k in kpis if k.risk_category == "ANOMALY")
    
    return {
        "total_pre": total_pre,
        "total_post": total_post,
        "total_additions": total_additions,
        "total_deletions": total_deletions,
        "avg_net_change_percent": avg_net_change_percent,
        "avg_deletion_velocity": avg_deletion_velocity,
        "avg_youth_intake_percent": avg_youth_intake_percent,
        "avg_youth_18_19_percent": avg_youth_18_19_percent,
        "avg_youth_20_25_percent": avg_youth_20_25_percent,
        "avg_gender_shift_percent": avg_gender_shift_percent,
        "total_anomaly_households": total_anomaly_households,
        "high_risk_booths": high_risk_booths,
        "high_opportunity_booths": high_opportunity_booths,
        "anomaly_booths": anomaly_booths
    }

@router.post("/calculate/{constituency_id}")
async def calculate_kpis(constituency_id: int, db: Session = Depends(get_db)):
    """Calculate and update KPIs for all booths in a constituency"""
    try:
        engine = KPIEngine(db)
        engine.calculate_booth_kpis(constituency_id)
        return {"message": "KPIs calculated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating KPIs: {str(e)}")

@router.get("/booths/{constituency_id}")
async def get_booths_kpi(constituency_id: int, db: Session = Depends(get_db)):
    """Get KPI data for all booths in a constituency"""
    booths = db.query(Booth).filter(Booth.constituency_id == constituency_id).all()
    booth_ids = [b.id for b in booths]
    
    kpis = db.query(BoothKPI).filter(BoothKPI.booth_id.in_(booth_ids)).all()
    kpi_dict = {k.booth_id: k for k in kpis}
    
    result = []
    for booth in booths:
        kpi = kpi_dict.get(booth.id)
        result.append({
            "booth_id": booth.id,
            "booth_number": booth.booth_number,
            "location_name": booth.location_name,
            "total_pre": kpi.total_pre if kpi else 0,
            "total_post": kpi.total_post if kpi else 0,
            "additions": kpi.additions if kpi else 0,
            "deletions": kpi.deletions if kpi else 0,
            "net_change_percent": float(kpi.net_change_percent) if kpi and kpi.net_change_percent else 0.0,
            "deletion_velocity": float(kpi.deletion_velocity) if kpi and kpi.deletion_velocity else 0.0,
            "youth_intake_percent": float(kpi.youth_intake_percent) if kpi and kpi.youth_intake_percent else 0.0,
            "youth_18_19_percent": float(getattr(kpi, "youth_18_19_percent", None) or 0) if kpi else 0.0,
            "youth_20_25_percent": float(getattr(kpi, "youth_20_25_percent", None) or 0) if kpi else 0.0,
            "gender_shift_percent": float(kpi.gender_shift_percent) if kpi and kpi.gender_shift_percent else 0.0,
            "anomaly_household_count": kpi.anomaly_household_count if kpi else 0,
            "risk_category": kpi.risk_category if kpi else "NORMAL"
        })
    
    return result
