"""
Profiler Controller - FastAPI version of CI3 Speedtest/Profiler
Provides profiler data endpoints for authorized users (KTech employees)
Matches CI3 MY_Profiler behavior
"""
import logging
import time
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from database.connection import get_db
from helpers.security_helper import get_current_user
from helpers.profiler_helper import (
    PROFILING_ENABLED,
    get_stored_profiler_data,
    get_all_stored_requests,
    clear_stored_requests,
    
)
from config.constants import TBL_ADMIN, TBL_CONFIGURATION, TBL_ROLES, TBL_KICKOUT, COLLEGE_PROJECT_ID
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/profiler", tags=["profiler"])


@router.get("/data")
async def get_profiler_data(
    request: Request,
    type: Optional[str] = "page",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get profiler data for current session.
    Only available for KTech users (matches CI3 checkemailktech()).
    Returns data from the last request made by this user.
    
    Args:
        type: 'page' or 'ajax' - type of profiler data to retrieve
    """
    
    
    is_ajax = type == "ajax"
    session_id = str(current_user.id)  # Use user ID as session identifier
    
    # Get page data (most recent non-ajax request)
    page_data = get_stored_profiler_data(session_id, is_ajax=False)
    # Get ajax data (most recent ajax request)
    ajax_data = get_stored_profiler_data(session_id, is_ajax=True)
    
    # Return the requested type
    data = ajax_data if is_ajax else page_data
    
    if not data:
        return {
            "enabled": True,
            "data": None,
            "message": f"No {'AJAX' if is_ajax else 'page'} profiler data available. Make a request first, then check profiler.",
            "has_page_data": page_data is not None,
            "has_ajax_data": ajax_data is not None
        }
    
    return {
        "enabled": True,
        "data": data,
        "type": "ajax" if is_ajax else "page",
        "has_page_data": page_data is not None,
        "has_ajax_data": ajax_data is not None
    }


@router.get("/requests")
async def get_request_profiles(
    current_user: User = Depends(get_current_user),
):
    """
    Get all recent request profiles for this user.
    Shows every API call with its SQL queries and timing.
    """
   
    
    session_id = str(current_user.id)
    requests_data = get_all_stored_requests(session_id)
    
    return {
        "enabled": True,
        "requests": requests_data,
        "total_requests": len(requests_data),
    }


@router.post("/clear")
async def clear_request_profiles(
    current_user: User = Depends(get_current_user),
):
    """Clear stored request profiles for this user."""
 
    
    session_id = str(current_user.id)
    clear_stored_requests(session_id)
    return {"success": True, "message": "Profiler data cleared"}


@router.get("/speedtest")
async def speedtest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Database speed test - matches CI3 Speedtest controller.
    Only available for KTech users.
    """
   
    
    results = {
        "tests": [],
        "summary": {}
    }
    
    # Test 1: Simple SELECT (connectivity check)
    start = time.time()
    try:
        db.execute(text("SELECT 1"))
        results["tests"].append({
            "name": "Simple SELECT",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass"
        })
    except Exception as e:
        results["tests"].append({
            "name": "Simple SELECT",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Test 2: Count query on user table (PORTAL_ADMIN)
    start = time.time()
    try:
        result = db.execute(text(f"SELECT COUNT(*) as cnt FROM {TBL_ADMIN} WITH(NOLOCK)")).fetchone()
        results["tests"].append({
            "name": f"Count {TBL_ADMIN}",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass",
            "result": result[0] if result else 0
        })
    except Exception as e:
        results["tests"].append({
            "name": f"Count {TBL_ADMIN}",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Test 3: Settings query (PORTAL_CONFIGURATION)
    start = time.time()
    try:
        result = db.execute(text(f"SELECT TOP 5 * FROM {TBL_CONFIGURATION} WITH(NOLOCK)")).fetchall()
        results["tests"].append({
            "name": f"Settings Query ({TBL_CONFIGURATION})",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass",
            "rows_returned": len(result)
        })
    except Exception as e:
        results["tests"].append({
            "name": f"Settings Query ({TBL_CONFIGURATION})",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Test 4: Join query performance (PORTAL_ADMIN + PORTAL_ROLES)
    start = time.time()
    try:
        result = db.execute(text(f"""
            SELECT TOP 10 u.id, u.name, r.ROLE_NAME 
            FROM {TBL_ADMIN} u WITH(NOLOCK)
            JOIN {TBL_ROLES} r WITH(NOLOCK) ON u.role_id = r.ID
        """)).fetchall()
        results["tests"].append({
            "name": "User-Role Join",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass",
            "rows_returned": len(result)
        })
    except Exception as e:
        results["tests"].append({
            "name": "User-Role Join",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Test 5: Heavy table count (DIGISCRIPT_LOG)
    start = time.time()
    try:
        result = db.execute(text(f"""
            SELECT COUNT(*) as cnt FROM {TBL_KICKOUT} WITH(NOLOCK)
            WHERE PROJECT_ID = {COLLEGE_PROJECT_ID}
        """)).fetchone()
        results["tests"].append({
            "name": f"Count {TBL_KICKOUT} (College)",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass",
            "result": result[0] if result else 0
        })
    except Exception as e:
        results["tests"].append({
            "name": f"Count {TBL_KICKOUT} (College)",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Calculate summary
    total_time = sum(t.get("duration_ms", 0) for t in results["tests"])
    pass_count = sum(1 for t in results["tests"] if t.get("status") == "pass")
    
    results["summary"] = {
        "total_tests": len(results["tests"]),
        "passed": pass_count,
        "failed": len(results["tests"]) - pass_count,
        "total_time_ms": round(total_time, 2),
        "average_time_ms": round(total_time / len(results["tests"]), 2) if results["tests"] else 0
    }
    
    return results


@router.get("/status")
async def profiler_status(
    current_user: User = Depends(get_current_user),
):
    """
    Get profiler status - whether it's enabled for current user.
    """
    
    
    return {
        "enabled": is_user_authorized,
        "profiling_active": PROFILING_ENABLED,
        "user_email": current_user.email,
        "message": (
            "Profiler enabled"
            if is_user_authorized and PROFILING_ENABLED
            else "Profiler access restricted"
            if not is_user_authorized
            else "Profiling disabled (ENABLE_PROFILING=False in .env)"
        ),
    }
