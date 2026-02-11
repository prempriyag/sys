"""
Notification Scheduler
Uses APScheduler to run daily notification jobs that generate
in-app notifications for users based on system activity.

Jobs:
  1. Daily Kickout Summary    – counts new transcript & articulation kickouts
  2. Stale Kickouts Alert     – kickouts unresolved for > 3 days
  3. Bot Run Status Digest    – yesterday's bot run success/failure summary
  4. Transcript Upload Summary – transcripts uploaded in last 24 h
  5. Cleanup                  – delete notifications older than 30 days
"""
import logging
from datetime import datetime
from typing import Optional
from contextlib import contextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import text

from database.connection import SessionLocal
from models.notification_model import NotificationModel
from config.constants import (
    TBL_KICKOUT, TBL_ARTICULATION, TBL_DOWNLOAD,
    TBL_DIGISCRIPTBOTLOG, TBL_ARTICULATIONBOTLOG,
    TBL_NOTIFICATIONS,
)

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ #
# Helper: scoped DB session for background jobs
# ------------------------------------------------------------------ #
@contextmanager
def get_job_db():
    """Yield a DB session for scheduler jobs (outside request context)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------------------------------------------------------ #
# JOB 1 – Daily Kickout Summary (runs at 07:00 every day)
# ------------------------------------------------------------------ #
def job_daily_kickout_summary():
    """Count kickouts created in the last 24 hours and post a global notification."""
    try:
        with get_job_db() as db:
            # Transcript kickouts (last 24 h)
            t_q = text(f"""
                SELECT COUNT(*) FROM {TBL_KICKOUT} WITH(NOLOCK)
                WHERE Status = 'Failed'
                  AND LAST_UPDATED_DATETIME >= DATEADD(HOUR, -24, GETDATE())
            """)
            transcript_kickouts = db.execute(t_q).scalar() or 0

            # Articulation kickouts (last 24 h)
            a_q = text(f"""
                SELECT COUNT(*) FROM {TBL_ARTICULATION} WITH(NOLOCK)
                WHERE ARTICULATION_STATUS_FLAG = 'Failed'
                  AND LAST_UPDATED_DATETIME >= DATEADD(HOUR, -24, GETDATE())
            """)
            articulation_kickouts = db.execute(a_q).scalar() or 0

            total = transcript_kickouts + articulation_kickouts
            if total == 0:
                logger.info("[SCHEDULER] No new kickouts in last 24h – skipping notification.")
                return

            message = (
                f"{total} new kickout(s) in the last 24 hours: "
                f"{transcript_kickouts} transcript, {articulation_kickouts} articulation."
            )
            NotificationModel.create_notification(
                db,
                title="Daily Kickout Summary",
                message=message,
                type="warning",
                category="kickouts",
                link="/college/transcriptkickouts",
                is_global=True,
                created_by="Scheduler",
            )
            logger.info(f"[SCHEDULER] Daily kickout summary: {message}")
    except Exception as e:
        logger.error(f"[SCHEDULER] job_daily_kickout_summary failed: {e}")


# ------------------------------------------------------------------ #
# JOB 2 – Stale Kickouts Alert (runs at 08:00 every day)
# ------------------------------------------------------------------ #
def job_stale_kickouts_alert():
    """Warn about kickouts that have been unresolved for more than 3 days."""
    try:
        with get_job_db() as db:
            q = text(f"""
                SELECT COUNT(*) FROM {TBL_KICKOUT} WITH(NOLOCK)
                WHERE Status = 'Failed'
                  AND (ARTICULATION_STATUS_FLAG IS NULL OR ARTICULATION_STATUS_FLAG = '0')
                  AND LAST_UPDATED_DATETIME < DATEADD(DAY, -3, GETDATE())
            """)
            stale = db.execute(q).scalar() or 0
            if stale == 0:
                return

            message = (
                f"{stale} kickout(s) have been unresolved for more than 3 days and need attention."
            )
            NotificationModel.create_notification(
                db,
                title="Stale Kickouts Need Attention",
                message=message,
                type="error",
                category="kickouts",
                link="/college/transcriptkickouts",
                is_global=True,
                created_by="Scheduler",
            )
            logger.info(f"[SCHEDULER] Stale kickouts alert: {stale}")
    except Exception as e:
        logger.error(f"[SCHEDULER] job_stale_kickouts_alert failed: {e}")


# ------------------------------------------------------------------ #
# JOB 3 – Bot Run Status Digest (runs at 07:30 every day)
# ------------------------------------------------------------------ #
def job_bot_status_digest():
    """Summarise yesterday's bot runs (DigiScript + Articulation)."""
    try:
        with get_job_db() as db:
            ds_q = text(f"""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN BOT_STATUS = 'Completed' THEN 1 ELSE 0 END) AS ok,
                    SUM(CASE WHEN BOT_STATUS != 'Completed' THEN 1 ELSE 0 END) AS fail
                FROM {TBL_DIGISCRIPTBOTLOG} WITH(NOLOCK)
                WHERE CONVERT(DATE, CREATED_DATETIME) = CONVERT(DATE, DATEADD(DAY, -1, GETDATE()))
            """)
            ds = db.execute(ds_q).fetchone()
            ds_total = ds.total if ds else 0
            ds_ok = ds.ok if ds else 0
            ds_fail = ds.fail if ds else 0

            ar_q = text(f"""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN BOT_STATUS = 'Completed' THEN 1 ELSE 0 END) AS ok,
                    SUM(CASE WHEN BOT_STATUS != 'Completed' THEN 1 ELSE 0 END) AS fail
                FROM {TBL_ARTICULATIONBOTLOG} WITH(NOLOCK)
                WHERE CONVERT(DATE, CREATED_DATETIME) = CONVERT(DATE, DATEADD(DAY, -1, GETDATE()))
            """)
            ar = db.execute(ar_q).fetchone()
            ar_total = ar.total if ar else 0
            ar_ok = ar.ok if ar else 0
            ar_fail = ar.fail if ar else 0

            grand_total = ds_total + ar_total
            if grand_total == 0:
                logger.info("[SCHEDULER] No bot runs yesterday – skipping digest.")
                return

            ntype = "success" if (ds_fail + ar_fail) == 0 else "warning"
            message = (
                f"Yesterday's bot runs: DigiScript {ds_ok}/{ds_total} succeeded, "
                f"Articulation {ar_ok}/{ar_total} succeeded."
            )
            if (ds_fail + ar_fail) > 0:
                message += f" {ds_fail + ar_fail} run(s) need review."

            NotificationModel.create_notification(
                db,
                title="Bot Status Daily Digest",
                message=message,
                type=ntype,
                category="bot_status",
                link="/college/digiscriptbotlog",
                is_global=True,
                created_by="Scheduler",
            )
            logger.info(f"[SCHEDULER] Bot digest: {message}")
    except Exception as e:
        logger.error(f"[SCHEDULER] job_bot_status_digest failed: {e}")


# ------------------------------------------------------------------ #
# JOB 4 – Transcript Upload Summary (runs at 07:15 every day)
# ------------------------------------------------------------------ #
def job_transcript_upload_summary():
    """Count transcripts uploaded / processed in the last 24 hours."""
    try:
        with get_job_db() as db:
            q = text(f"""
                SELECT COUNT(*) FROM {TBL_DOWNLOAD} WITH(NOLOCK)
                WHERE CREATEDDATETIME >= DATEADD(HOUR, -24, GETDATE())
            """)
            count = db.execute(q).scalar() or 0
            if count == 0:
                return

            message = f"{count} transcript(s) were uploaded in the last 24 hours."
            NotificationModel.create_notification(
                db,
                title="Transcript Upload Summary",
                message=message,
                type="info",
                category="transcripts",
                link="/college/transcripts",
                is_global=True,
                created_by="Scheduler",
            )
            logger.info(f"[SCHEDULER] Transcript upload summary: {count}")
    except Exception as e:
        logger.error(f"[SCHEDULER] job_transcript_upload_summary failed: {e}")


# ------------------------------------------------------------------ #
# JOB 5 – Cleanup old notifications (runs at 02:00 every day)
# ------------------------------------------------------------------ #
def job_cleanup_old_notifications():
    """Delete notifications older than 30 days."""
    try:
        with get_job_db() as db:
            deleted = NotificationModel.delete_old_notifications(db, days=30)
            if deleted:
                logger.info(f"[SCHEDULER] Cleaned up {deleted} old notification(s).")
    except Exception as e:
        logger.error(f"[SCHEDULER] job_cleanup_old_notifications failed: {e}")


# ------------------------------------------------------------------ #
# JOB 0 – Ensure table exists on startup + run all jobs once
# ------------------------------------------------------------------ #
def job_ensure_table_and_seed():
    """
    Create the notifications table if it doesn't exist,
    then run every notification job once so there is immediate data.
    """
    try:
        with get_job_db() as db:
            NotificationModel.ensure_table_exists(db)
            logger.info("[SCHEDULER] Table ensured. Running initial notification jobs...")
    except Exception as e:
        logger.error(f"[SCHEDULER] job_ensure_table failed: {e}")
        # Don't return early – still try to create welcome notification below
        # because the table may already exist even if ensure_table threw.

    # Run each job once so users see notifications right away
    jobs_created = 0
    for job_fn in [
        job_daily_kickout_summary,
        job_transcript_upload_summary,
        job_bot_status_digest,
        job_stale_kickouts_alert,
    ]:
        try:
            job_fn()
            jobs_created += 1
        except Exception as e:
            logger.error(f"[SCHEDULER] initial run of {job_fn.__name__} failed: {e}")

    # Check if any notifications were actually created; if not, add a welcome one
    try:
        with get_job_db() as db:
            q = text(f"SELECT COUNT(*) FROM {TBL_NOTIFICATIONS} WITH(NOLOCK)")
            count = db.execute(q).scalar() or 0
            if count == 0:
                NotificationModel.create_notification(
                    db,
                    title="Notifications are live!",
                    message="You will receive daily summaries about kickouts, bot runs, transcript uploads, and more.",
                    type="success",
                    category="system",
                    link="",
                    is_global=True,
                    created_by="System",
                )
                logger.info("[SCHEDULER] Created welcome notification.")
            else:
                logger.info(f"[SCHEDULER] {count} notification(s) already exist – skipping welcome.")
    except Exception as e:
        logger.error(f"[SCHEDULER] welcome notification check/create failed: {e}")


# ------------------------------------------------------------------ #
# SCHEDULER ENTRYPOINT
# ------------------------------------------------------------------ #
_scheduler: Optional[BackgroundScheduler] = None


def start_scheduler(app=None):
    """Start the APScheduler background scheduler with all notification jobs."""
    global _scheduler
    if _scheduler is not None:
        return  # already running

    _scheduler = BackgroundScheduler(timezone="America/Chicago")  # CST for OSU-OKC

    # Run once at startup: ensure table exists + seed initial notifications
    _scheduler.add_job(job_ensure_table_and_seed, "date", id="ensure_table_and_seed")

    # Daily scheduled jobs (all times in CST)
    _scheduler.add_job(
        job_daily_kickout_summary,
        CronTrigger(hour=7, minute=0),
        id="daily_kickout_summary",
        replace_existing=True,
    )
    _scheduler.add_job(
        job_transcript_upload_summary,
        CronTrigger(hour=7, minute=15),
        id="transcript_upload_summary",
        replace_existing=True,
    )
    _scheduler.add_job(
        job_bot_status_digest,
        CronTrigger(hour=7, minute=30),
        id="bot_status_digest",
        replace_existing=True,
    )
    _scheduler.add_job(
        job_stale_kickouts_alert,
        CronTrigger(hour=8, minute=0),
        id="stale_kickouts_alert",
        replace_existing=True,
    )
    _scheduler.add_job(
        job_cleanup_old_notifications,
        CronTrigger(hour=2, minute=0),
        id="cleanup_old_notifications",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("[SCHEDULER] APScheduler started with %d jobs.", len(_scheduler.get_jobs()))

    # Shutdown scheduler when app stops
    if app is not None:
        import atexit
        atexit.register(lambda: _scheduler.shutdown(wait=False))
