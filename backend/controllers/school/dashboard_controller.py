"""
Dashboard Controller - College Module
FastAPI version of CI3 Dashboard controller
Provides comprehensive dashboard analytics and metrics
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.dashboard_model import DashboardModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/school/dashboard",
    tags=["dashboard"],
)


class DashboardRequest(BaseModel):
    college_name: Optional[str] = ""
    fromdate: Optional[str] = None
    todate: Optional[str] = None


@router.post("/data")
async def get_dashboard_data(
    request: DashboardRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(require_permission("college_dashboard", "VIEW")),
    db: Session = Depends(get_db),
):
    """
    Get comprehensive dashboard data
    Matches CI3 Dashboard::index() method
    """
    try:
        # Set default date range if not provided (4 months ago to today)
        if not request.fromdate:
            four_months_ago = datetime.now() - timedelta(days=120)
            request.fromdate = four_months_ago.replace(day=1).strftime('%Y-%m-%d')
        if not request.todate:
            request.todate = datetime.now().strftime('%Y-%m-%d')

        # Add time to dates
        fromdate_str = f"{request.fromdate} 00:00:00"
        todate_str = f"{request.todate} 23:59:59"

        # Calculate date difference
        date1_ts = datetime.strptime(fromdate_str, '%Y-%m-%d %H:%M:%S')
        date2_ts = datetime.strptime(todate_str, '%Y-%m-%d %H:%M:%S')
        date_diff = (date2_ts - date1_ts).days

        # Determine if we should use daily or monthly grouping
        max_days = 10
        use_daily = date_diff > 0 and date_diff < max_days

        # Get dashboard data
        dashboard_data = DashboardModel.get_dashboard_data(
            db=db,
            college_name=request.college_name or "",
            fromdate=fromdate_str,
            todate=todate_str,
            use_daily=use_daily,
        )

        return dashboard_data

    except Exception as e:
        logger.exception("Dashboard data error")
        raise HTTPException(status_code=500, detail=f"Error fetching dashboard data: {str(e)}")


@router.get("/colleges")
async def get_colleges_list(
    q: Optional[str] = None,
    # current_user: User = Depends(require_permission("college_dashboard", "VIEW")),
    db: Session = Depends(get_db),
):
    """
    Get list of colleges for filter dropdown
    Matches CI3 Dashboard::getcollegelist() method
    """
    try:
        colleges = DashboardModel.get_colleges_list(db=db, search_term=q or "")
        return colleges
    except Exception as e:
        logger.exception("Get colleges list error")
        raise HTTPException(status_code=500, detail=f"Error fetching colleges: {str(e)}")



