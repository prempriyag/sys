"""
OCR Verify - Dashboard controller.
CI: ocrverify Dashboard::index(), getcollegelist()
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from database.connection import get_db
from models.ocr_dashboard_model import OCRDashboardModel

router = APIRouter(prefix="/api/ocrverify", tags=["ocr-dashboard"])


@router.get("/dashboard/counts")
async def dashboard_counts(db: Session = Depends(get_db)):
    """
    Get OCR dashboard counts for charts and stats.
    Matches CI3 Dashboard::index() -> Collegeverifier::dashboardcounts()
    """
    try:
        counts = OCRDashboardModel.dashboard_counts(db=db)
        return counts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard counts: {str(e)}")


@router.get("/dashboard/getcollegelist")
async def getcollegelist(
    q: Optional[str] = Query(None, alias="q"),
    db: Session = Depends(get_db),
):
    """
    Get institution list for autocomplete (Select2 / filter).
    Matches CI3 Dashboard::getcollegelist()
    """
    try:
        if not q or not q.strip():
            return []
        institutions = OCRDashboardModel.get_college_list(db=db, search_term=q.strip())
        return institutions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching institution list: {str(e)}")
