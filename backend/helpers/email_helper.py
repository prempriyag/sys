"""
Email helper - sends emails via SMTP from PORTAL_SMTP
Based on sendmail() from CI3 common_helper.php
"""
import logging
import smtplib
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from sqlalchemy import text
from config.constants import TBL_SMTP

logger = logging.getLogger(__name__)


def get_smtp_config(db: Session) -> Optional[dict]:
    """Get SMTP config from PORTAL_SMTP table."""
    try:
        query = text(f"SELECT TOP 1 host, username, password, port FROM {TBL_SMTP} WITH(NOLOCK) ORDER BY id")
        result = db.execute(query).fetchone()
        if result:
            row = dict(result._mapping)
            if row.get("host") and str(row.get("host", "")).strip():
                return {
                    "host": str(row.get("host", "")).strip(),
                    "port": int(row.get("port")) if row.get("port") not in (None, "") else 587,
                    "username": str(row.get("username", "")).strip(),
                    "password": str(row.get("password", "") or ""),
                }
    except Exception as e:
        logger.exception("Error getting SMTP config: %s", e)
    return None


def send_email(db: Session, to: str, subject: str, html_body: str) -> bool:
    """
    Send HTML email via SMTP.
    Returns True on success, False otherwise.
    """
    config = get_smtp_config(db)
    if not config:
        logger.warning("SMTP not configured - cannot send email")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config["username"]
        msg["To"] = to
        part = MIMEText(html_body, "html")
        msg.attach(part)
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            if config.get("username") and config.get("password"):
                server.login(config["username"], config["password"])
            server.sendmail(config["username"], [to], msg.as_string())
        return True
    except Exception as e:
        logger.exception("Error sending email: %s", e)
        return False
