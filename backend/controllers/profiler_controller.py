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
    get_stored_profiler_data,
    is_ktech_user,
)
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
    
    Args:
        type: 'page' or 'ajax' - type of profiler data to retrieve
    """
    # Check if user is authorized (KTech employee)
    if not is_ktech_user(current_user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Profiler access restricted to authorized users"
        )
    
    is_ajax = type == "ajax"
    session_id = str(current_user.id)  # Use user ID as session identifier
    
    data = get_stored_profiler_data(session_id, is_ajax)
    
    if not data:
        return {
            "enabled": True,
            "data": None,
            "message": "No profiler data available for this session"
        }
    
    return {
        "enabled": True,
        "data": data
    }


@router.get("/speedtest")
async def speedtest(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Database speed test - matches CI3 Speedtest controller.
    Only available for KTech users.
    """
    # Check if user is authorized (KTech employee)
    if not is_ktech_user(current_user.email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Speedtest access restricted to authorized users"
        )
    
    results = {
        "tests": [],
        "summary": {}
    }
    
    # Test 1: Simple SELECT
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
    
    # Test 2: Count query on a table
    start = time.time()
    try:
        result = db.execute(text("SELECT COUNT(*) as cnt FROM PORTAL_USER WITH(NOLOCK)")).fetchone()
        results["tests"].append({
            "name": "Count PORTAL_USER",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass",
            "result": result[0] if result else 0
        })
    except Exception as e:
        results["tests"].append({
            "name": "Count PORTAL_USER",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Test 3: Settings query
    start = time.time()
    try:
        result = db.execute(text("SELECT TOP 5 * FROM PORTAL_SETTINGS WITH(NOLOCK)")).fetchall()
        results["tests"].append({
            "name": "Settings Query",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "pass",
            "rows_returned": len(result)
        })
    except Exception as e:
        results["tests"].append({
            "name": "Settings Query",
            "duration_ms": round((time.time() - start) * 1000, 2),
            "status": "fail",
            "error": str(e)
        })
    
    # Test 4: Join query performance
    start = time.time()
    try:
        result = db.execute(text("""
            SELECT TOP 10 u.id, u.name, r.ROLE_NAME 
            FROM PORTAL_USER u WITH(NOLOCK)
            JOIN PORTAL_ROLE r WITH(NOLOCK) ON u.role_id = r.ID
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
    is_enabled = is_ktech_user(current_user.email)
    
    return {
        "enabled": is_enabled,
        "user_email": current_user.email,
        "message": "Profiler enabled" if is_enabled else "Profiler access restricted"
    }
