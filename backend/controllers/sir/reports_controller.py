"""Report export: Executive Summary, Booth Action Plan (CSV, Excel, PDF)."""
import io
import csv
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.booth import Booth
from models.sir.kpi import BoothKPI
from models.sir.constituency import Constituency

router = APIRouter(prefix="/api/sir/reports", tags=["SIR Reports"])


def _get_constituency_summary(db: Session, constituency_id: int):
    """Aggregate KPI for constituency."""
    kpis = db.query(BoothKPI).join(Booth).filter(Booth.constituency_id == constituency_id).all()
    if not kpis:
        return None
    c = db.query(Constituency).filter(Constituency.id == constituency_id).first()
    total_pre = sum(k.total_pre for k in kpis)
    total_post = sum(k.total_post for k in kpis)
    total_additions = sum(k.additions for k in kpis)
    total_deletions = sum(k.deletions for k in kpis)
    high_risk = sum(1 for k in kpis if k.risk_category == "HIGH_RISK")
    high_opportunity = sum(1 for k in kpis if k.risk_category == "HIGH_OPPORTUNITY")
    anomaly = sum(1 for k in kpis if k.risk_category == "ANOMALY")
    return {
        "constituency_id": constituency_id,
        "name": c.name if c else "",
        "district": c.district if c else "",
        "state": c.state if c else "",
        "total_pre": total_pre,
        "total_post": total_post,
        "total_additions": total_additions,
        "total_deletions": total_deletions,
        "net_change": total_post - total_pre,
        "high_risk_booths": high_risk,
        "high_opportunity_booths": high_opportunity,
        "anomaly_booths": anomaly,
    }


@router.get("/executive-summary/csv")
def export_executive_summary_csv(
    constituency_id: int = Query(..., description="Constituency ID"),
    db: Session = Depends(get_db),
):
    """Export Executive Summary as CSV."""
    summary = _get_constituency_summary(db, constituency_id)
    if not summary:
        raise HTTPException(status_code=404, detail="No data for this constituency. Run matching first.")
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow(["Metric", "Value"])
    w.writerow(["Constituency", summary["name"]])
    w.writerow(["District", summary["district"]])
    w.writerow(["State", summary["state"]])
    w.writerow(["Total Pre-SIR", summary["total_pre"]])
    w.writerow(["Total Post-SIR", summary["total_post"]])
    w.writerow(["Additions", summary["total_additions"]])
    w.writerow(["Deletions", summary["total_deletions"]])
    w.writerow(["Net Change", summary["net_change"]])
    w.writerow(["High Risk Booths", summary["high_risk_booths"]])
    w.writerow(["High Opportunity Booths", summary["high_opportunity_booths"]])
    w.writerow(["Anomaly Booths", summary["anomaly_booths"]])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=executive_summary.csv"},
    )


@router.get("/booth-action-plan/csv")
def export_booth_action_plan_csv(
    constituency_id: int = Query(..., description="Constituency ID"),
    risk_filter: str = Query("HIGH_RISK,ANOMALY", description="Comma-separated risk categories"),
    db: Session = Depends(get_db),
):
    """Export Booth Action Plan (high-risk/anomaly booths) as CSV."""
    categories = [x.strip() for x in risk_filter.split(",") if x.strip()]
    booths = (
        db.query(Booth, BoothKPI)
        .outerjoin(BoothKPI, Booth.id == BoothKPI.booth_id)
        .filter(Booth.constituency_id == constituency_id)
    ).all()
    rows = []
    for b, kpi in booths:
        if not kpi or kpi.risk_category not in categories:
            continue
        rows.append({
            "booth_number": b.booth_number,
            "location_name": b.location_name or "",
            "total_pre": kpi.total_pre,
            "total_post": kpi.total_post,
            "additions": kpi.additions,
            "deletions": kpi.deletions,
            "net_change_percent": float(kpi.net_change_percent) if kpi.net_change_percent else 0,
            "deletion_velocity": float(kpi.deletion_velocity) if kpi.deletion_velocity else 0,
            "risk_category": kpi.risk_category or "",
            "risk_score": float(kpi.risk_score) if kpi.risk_score is not None else 0,
            "anomaly_household_count": kpi.anomaly_household_count or 0,
        })
    output = io.StringIO()
    w = csv.writer(output)
    w.writerow([
        "booth_number", "location_name", "total_pre", "total_post", "additions", "deletions",
        "net_change_percent", "deletion_velocity", "risk_category", "risk_score", "anomaly_household_count"
    ])
    for r in rows:
        w.writerow([r["booth_number"], r["location_name"], r["total_pre"], r["total_post"], r["additions"], r["deletions"],
                    r["net_change_percent"], r["deletion_velocity"], r["risk_category"], r["risk_score"], r["anomaly_household_count"]])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=booth_action_plan.csv"},
    )
