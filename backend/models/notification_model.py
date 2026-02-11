"""
Notification Model
Handles database queries for the notification system.
Table: PORTAL_NOTIFICATIONS
"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

from config.constants import TBL_NOTIFICATIONS

logger = logging.getLogger(__name__)


class NotificationModel:
    """Model for PORTAL_NOTIFICATIONS table operations."""

    # ------------------------------------------------------------------ #
    # TABLE BOOTSTRAP (auto-create if missing)
    # ------------------------------------------------------------------ #
    @staticmethod
    def ensure_table_exists(db: Session) -> None:
        """Create PORTAL_NOTIFICATIONS table if it doesn't already exist."""
        try:
            db.execute(text(f"""
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = '{TBL_NOTIFICATIONS}'
                )
                BEGIN
                    CREATE TABLE {TBL_NOTIFICATIONS} (
                        Id          INT IDENTITY(1,1) PRIMARY KEY,
                        user_id     INT NULL,
                        title       NVARCHAR(255) NOT NULL,
                        message     NVARCHAR(MAX) NOT NULL,
                        type        NVARCHAR(50) NOT NULL DEFAULT 'info',
                        category    NVARCHAR(100) NULL,
                        link        NVARCHAR(500) NULL,
                        is_read     BIT NOT NULL DEFAULT 0,
                        is_global   BIT NOT NULL DEFAULT 0,
                        created_at  DATETIME NOT NULL DEFAULT GETDATE(),
                        read_at     DATETIME NULL,
                        created_by  NVARCHAR(255) NULL DEFAULT 'System'
                    )
                END
            """))
            db.commit()
            logger.info("PORTAL_NOTIFICATIONS table ensured.")
        except Exception as e:
            db.rollback()
            logger.error(f"Error ensuring notifications table: {e}")

    # ------------------------------------------------------------------ #
    # READ
    # ------------------------------------------------------------------ #
    @staticmethod
    def get_notifications(
        db: Session,
        user_id: int,
        unread_only: bool = False,
        limit: int = 20,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Get notifications for a user.
        Returns both personal (user_id match) and global (is_global=1) notifications.
        """
        try:
            where = f"(user_id = :uid OR is_global = 1)"
            if unread_only:
                where += " AND is_read = 0"

            # Total unread count (always useful for badge)
            unread_q = text(f"""
                SELECT COUNT(*) AS cnt
                FROM {TBL_NOTIFICATIONS} WITH(NOLOCK)
                WHERE (user_id = :uid OR is_global = 1) AND is_read = 0
            """)
            unread_count = db.execute(unread_q, {"uid": user_id}).scalar() or 0

            # Total matching rows
            count_q = text(f"""
                SELECT COUNT(*) AS cnt
                FROM {TBL_NOTIFICATIONS} WITH(NOLOCK)
                WHERE {where}
            """)
            total = db.execute(count_q, {"uid": user_id}).scalar() or 0

            # Fetch page
            data_q = text(f"""
                SELECT Id, user_id, title, message, type, category, link,
                       is_read, is_global, created_at, read_at, created_by
                FROM {TBL_NOTIFICATIONS} WITH(NOLOCK)
                WHERE {where}
                ORDER BY created_at DESC
                OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY
            """)
            rows = db.execute(data_q, {"uid": user_id, "off": offset, "lim": limit}).fetchall()

            notifications = []
            for r in rows:
                row = dict(r._mapping)
                created = row.get("created_at")
                read = row.get("read_at")
                notifications.append({
                    "id": row["Id"],
                    "user_id": row["user_id"],
                    "title": row["title"],
                    "message": row["message"],
                    "type": row["type"],
                    "category": row.get("category", ""),
                    "link": row.get("link", ""),
                    "is_read": bool(row["is_read"]),
                    "is_global": bool(row["is_global"]),
                    "created_at": created.isoformat() if created and hasattr(created, "isoformat") else str(created or ""),
                    "read_at": read.isoformat() if read and hasattr(read, "isoformat") else None,
                    "created_by": row.get("created_by", "System"),
                })

            return {
                "notifications": notifications,
                "total": total,
                "unread_count": unread_count,
            }
        except Exception as e:
            logger.error(f"Error fetching notifications: {e}")
            raise

    @staticmethod
    def get_unread_count(db: Session, user_id: int) -> int:
        """Quick unread badge count."""
        try:
            q = text(f"""
                SELECT COUNT(*) FROM {TBL_NOTIFICATIONS} WITH(NOLOCK)
                WHERE (user_id = :uid OR is_global = 1) AND is_read = 0
            """)
            return db.execute(q, {"uid": user_id}).scalar() or 0
        except Exception as e:
            logger.error(f"Error getting unread count: {e}")
            return 0

    # ------------------------------------------------------------------ #
    # WRITE
    # ------------------------------------------------------------------ #
    @staticmethod
    def create_notification(
        db: Session,
        title: str,
        message: str,
        type: str = "info",
        category: str = "",
        link: str = "",
        user_id: Optional[int] = None,
        is_global: bool = False,
        created_by: str = "System",
    ) -> int:
        """Insert a new notification. Returns new Id."""
        try:
            q = text(f"""
                INSERT INTO {TBL_NOTIFICATIONS}
                    (user_id, title, message, type, category, link, is_read, is_global, created_at, created_by)
                OUTPUT INSERTED.Id
                VALUES
                    (:uid, :title, :msg, :type, :cat, :link, 0, :glob, GETDATE(), :by)
            """)
            result = db.execute(q, {
                "uid": user_id,
                "title": title,
                "msg": message,
                "type": type,
                "cat": category,
                "link": link,
                "glob": 1 if is_global else 0,
                "by": created_by,
            })
            new_id = result.scalar()
            db.commit()
            return new_id
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating notification: {e}")
            raise

    # ------------------------------------------------------------------ #
    # UPDATE
    # ------------------------------------------------------------------ #
    @staticmethod
    def mark_as_read(db: Session, notification_id: int, user_id: int) -> bool:
        """Mark a single notification as read."""
        try:
            q = text(f"""
                UPDATE {TBL_NOTIFICATIONS}
                SET is_read = 1, read_at = GETDATE()
                WHERE Id = :nid AND (user_id = :uid OR is_global = 1)
            """)
            db.execute(q, {"nid": notification_id, "uid": user_id})
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error marking notification as read: {e}")
            return False

    @staticmethod
    def mark_all_as_read(db: Session, user_id: int) -> int:
        """Mark all notifications as read for a user. Returns affected row count."""
        try:
            q = text(f"""
                UPDATE {TBL_NOTIFICATIONS}
                SET is_read = 1, read_at = GETDATE()
                WHERE (user_id = :uid OR is_global = 1) AND is_read = 0
            """)
            result = db.execute(q, {"uid": user_id})
            db.commit()
            return result.rowcount
        except Exception as e:
            db.rollback()
            logger.error(f"Error marking all notifications as read: {e}")
            return 0

    # ------------------------------------------------------------------ #
    # DELETE (cleanup)
    # ------------------------------------------------------------------ #
    @staticmethod
    def delete_old_notifications(db: Session, days: int = 30) -> int:
        """Remove notifications older than N days."""
        try:
            q = text(f"""
                DELETE FROM {TBL_NOTIFICATIONS}
                WHERE created_at < DATEADD(DAY, -:days, GETDATE())
            """)
            result = db.execute(q, {"days": days})
            db.commit()
            return result.rowcount
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting old notifications: {e}")
            return 0
