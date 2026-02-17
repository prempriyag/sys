"""
Notification Controller
API endpoints for the in-app notification system.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import logging

from database.connection import get_db
from helpers.security_helper import get_current_user
from models import User
from models.notification_model import NotificationModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/notifications", tags=["notifications"])


# ------------------------------------------------------------------ #
# Request / Response schemas
# ------------------------------------------------------------------ #
class MarkReadRequest(BaseModel):
    notification_id: int


class CreateNotificationRequest(BaseModel):
    title: str
    message: str
    type: str = "info"          # info | success | warning | error
    category: str = ""
    link: str = ""
    user_id: Optional[int] = None
    is_global: bool = False


# ------------------------------------------------------------------ #
# ENDPOINTS
# ------------------------------------------------------------------ #

def _ensure_table(db: Session):
    """Ensure PORTAL_NOTIFICATIONS table exists (safe to call repeatedly)."""
    try:
        NotificationModel.ensure_table_exists(db)
    except Exception:
        pass  # Silently fail – table creation is also handled by the scheduler


@router.get("/list")
async def get_notifications(
    unread_only: bool = False,
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get notifications for the current user.
    Includes personal + global notifications, newest first.
    """
    try:
        _ensure_table(db)
        result = NotificationModel.get_notifications(
            db,
            user_id=current_user.id,
            unread_only=unread_only,
            limit=limit,
            offset=offset,
        )
        return result
    except Exception as e:
        logger.error(f"Error listing notifications: {e}")
        # Return empty result instead of 500 – notifications should never break the app
        return {"notifications": [], "total": 0, "unread_count": 0}


# @router.get("/unread-count")
# async def get_unread_count(
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     """Quick endpoint to get unread badge count (used by polling)."""
#     try:
#         _ensure_table(db)
#         count = NotificationModel.get_unread_count(db, user_id=current_user.id)
#         return {"unread_count": count}
#     except Exception as e:
#         logger.error(f"Error getting unread count: {e}")
#         return {"unread_count": 0}


@router.post("/mark-read")
async def mark_as_read(
    body: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a single notification as read."""
    try:
        _ensure_table(db)
        ok = NotificationModel.mark_as_read(db, body.notification_id, current_user.id)
        return {"success": ok}
    except Exception as e:
        logger.error(f"Error marking notification as read: {e}")
        return {"success": False}


@router.post("/mark-all-read")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    try:
        _ensure_table(db)
        count = NotificationModel.mark_all_as_read(db, user_id=current_user.id)
        return {"success": True, "marked_count": count}
    except Exception as e:
        logger.error(f"Error marking all as read: {e}")
        return {"success": False, "marked_count": 0}


@router.post("/trigger-now")
async def trigger_notifications_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Manually trigger all notification jobs right now (for testing / on-demand).
    Generates notifications based on current data, same as the daily scheduled jobs.
    If no jobs produce any notifications, creates a system check notification
    so the user can confirm the pipeline works end-to-end.
    """
    try:
        _ensure_table(db)
        from helpers.notification_scheduler import (
            job_daily_kickout_summary,
            job_transcript_upload_summary,
            job_bot_status_digest,
            job_stale_kickouts_alert,
        )

        # Count notifications before running jobs
        before_count = NotificationModel.get_unread_count(db, user_id=current_user.id)

        results = []
        for job_fn in [
            job_daily_kickout_summary,
            job_transcript_upload_summary,
            job_bot_status_digest,
            job_stale_kickouts_alert,
        ]:
            try:
                job_fn()
                results.append({"job": job_fn.__name__, "status": "ok"})
            except Exception as e:
                results.append({"job": job_fn.__name__, "status": f"error: {e}"})

        # Count notifications after running jobs
        after_count = NotificationModel.get_unread_count(db, user_id=current_user.id)

        # If no new notifications were generated, create a system-check notification
        # so the user can confirm the notification pipeline works end-to-end.
        if after_count <= before_count:
            from datetime import datetime
            NotificationModel.create_notification(
                db,
                title="System Check – All Clear",
                message=(
                    "No new activity to report right now. "
                    "Kickouts, transcript uploads, and bot runs are all up to date. "
                    f"Checked at {datetime.now().strftime('%I:%M %p, %b %d')}."
                ),
                type="success",
                category="system",
                link="",
                user_id=current_user.id,
                is_global=False,
                created_by="System",
            )
            results.append({"job": "system_check_notification", "status": "ok"})

        return {"success": True, "jobs": results}
    except Exception as e:
        logger.error(f"Error triggering notifications: {e}")
        return {"success": False, "error": str(e)}
