"""
Email helper - sends emails via SMTP from PORTAL_SMTP
Based on sendmail() from CI3 common_helper.php
"""
import logging
import smtplib
from typing import Optional, List, Union
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from sqlalchemy.orm import Session
from sqlalchemy import text
from config.constants import TBL_SMTP
from config.settings import settings

logger = logging.getLogger(__name__)


def get_smtp_config(db: Session) -> Optional[dict]:
    """Get SMTP config from settings table (matches CI3 getSetting approach)."""
    try:
        from helpers.db_helper import get_setting
        smtp_host = get_setting(db, 'smtp_host')
        smtp_port = get_setting(db, 'smtp_port')
        smtp_username = get_setting(db, 'smtp_username')
        smtp_password = get_setting(db, 'smtp_password')
        
        if smtp_host and str(smtp_host).strip():
            return {
                "host": str(smtp_host).strip(),
                "port": int(smtp_port) if smtp_port else 587,
                "username": str(smtp_username or "").strip(),
                "password": str(smtp_password or ""),
            }
        
        # Fallback to PORTAL_SMTP table
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


def send_email(db: Session, to: Union[str, List[str]], subject: str, html_body: str) -> bool:
    """
    Send HTML email via SMTP.
    Matches CI3 sendmail() function.
    
    Args:
        db: Database session
        to: Single email or list of emails
        subject: Email subject
        html_body: HTML content
        
    Returns True on success, False otherwise.
    """
    config = get_smtp_config(db)
    if not config:
        logger.warning("SMTP not configured - cannot send email")
        return False
    
    # Normalize recipients to list
    if isinstance(to, str):
        recipients = [to]
    else:
        recipients = to
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = config["username"]
        msg["To"] = ", ".join(recipients)
        part = MIMEText(html_body, "html")
        msg.attach(part)
        
        with smtplib.SMTP(config["host"], config["port"]) as server:
            server.starttls()
            if config.get("username") and config.get("password"):
                server.login(config["username"], config["password"])
            server.sendmail(config["username"], recipients, msg.as_string())
        
        logger.info(f"Email sent successfully to {recipients}")
        return True
    except Exception as e:
        logger.exception("Error sending email: %s", e)
        return False


def trigger_update_mail(db: Session, update_details: dict) -> bool:
    """
    Trigger update notification email (matches CI3 trigger_update_mail).
    
    Args:
        db: Database session
        update_details: Dictionary containing:
            - table_name: Table name
            - institution_type: 'College' or 'High School'
            - source_type: Source type
            - files_count: Number of files
            - uploaded_by: User who uploaded
            - uploaded_datetime: Upload timestamp
            - uploaded_files: List of filenames
    """
    from helpers.db_helper import get_setting
    
    trigger_update = get_setting(db, 'trigger_update')
    trigger_update_mail = get_setting(db, 'trigger_update_mail')
    
    if trigger_update != '1' and trigger_update != 1:
        logger.info("trigger_update is disabled, skipping email")
        return True
    
    if not trigger_update_mail:
        logger.warning("trigger_update_mail not configured")
        return False
    
    # Parse email addresses (comma-separated)
    email_list = [e.strip() for e in str(trigger_update_mail).split(',') if e.strip()]
    if not email_list:
        logger.warning("No valid email addresses in trigger_update_mail")
        return False
    
    system_name = get_setting(db, 'system_name') or 'DigiScript'
    ins_name = update_details.get('institution_type', '')
    
    # Build email HTML (matches CI3 trigger_update_mail.php template)
    html_body = _build_trigger_update_email_html(system_name, ins_name, update_details)
    
    subject = f"{system_name} - {ins_name} Updated from portal"
    
    return send_email(db, email_list, subject, html_body)


def _build_trigger_update_email_html(system_name: str, ins_name: str, update_details: dict) -> str:
    """Build HTML for trigger update email (matches CI3 trigger_update_mail.php)."""
    
    # Build file list table if uploaded_files present
    files_table = ""
    uploaded_files = update_details.get('uploaded_files', [])
    if uploaded_files:
        rows = ""
        for i, filename in enumerate(uploaded_files, 1):
            rows += f"""
            <tr>
                <td style="width:59px;text-align:center;">{i}</td>
                <td style="width:427px">{filename}</td>
            </tr>
            """
        files_table = f"""
        <table border="1" cellpadding="1" cellspacing="1" style="width:500px">
            <tr>
                <th style="width:59px;text-align:center;">S.No</th>
                <th style="width:427px">File Name</th>
            </tr>
            {rows}
        </table>
        """
    
    # Build details section
    details_html = ""
    for key, value in update_details.items():
        if key == 'uploaded_files' or isinstance(value, list):
            continue
        if key.startswith('_'):
            continue
        label = key.replace('_', ' ').title()
        details_html += f"""
        <p style="margin-bottom: 1rem;">
            <strong>{label}: </strong>
            <span>{value}</span>
        </p>
        """
    
    return f"""
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800&display=swap");
        table {{ width: 100%; border-collapse: collapse; }}
        td {{ padding: 10px; border: 1px solid #ccc; }}
        .header {{ background-color: #b31f24; font-weight: bold; padding: 10px; text-align: center; color: white; font-size: 17px; }}
        .content {{ text-align: left; }}
    </style>
    <body>
        <div style="background: none; border-radius: 10px; font-size: 14px; line-height: 28px; margin: 0; padding: 5px 10px; border: 1px solid #ccc;">
            <img src="https://ktechproducts.com/wp-content/uploads/2023/05/Ktech-color-cogo-746-x-156-01.png" width="230" alt="Logo" />
        </div>
        <table>
            <tr class="header-top">
                <td colspan="2" class="header">
                    {system_name} - {ins_name} Updated from portal
                </td>
            </tr>
            <tr>
                <td class="content" colspan="2">
                    <h4 style="text-align: left;">Dear <span style="color: #b31f24;">{system_name} User,</span></h4>
                    <p style="margin-bottom: 1rem; text-align: left;">
                        Please find the updated details as below.
                    </p>
                    {details_html}
                    {files_table}
                    <p>Sincerely yours,</p>
                    <p>The {system_name} Team.</p>
                    <p><strong>{system_name} - Powered by</strong> <a href="https://ktechproducts.com/"><span>www.ktechproducts.com</span></a></p>
                </td>
            </tr>
        </table>
    </body>
    """


def send_user_registration_email(db: Session, email: str, name: str, reset_link: str) -> bool:
    """
    Send user registration email with password setup link.
    Matches CI3: sendmail($emailid, getSetting('system_name').' User Registration Email', $message);
    """
    from helpers.db_helper import get_setting
    
    system_name = get_setting(db, 'system_name') or 'DigiScript'
    subject = f"{system_name} User Registration Email"
    
    html_body = f"""
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,600;0,700;0,800&display=swap");
        table {{ width: 100%; border-collapse: collapse; }}
        td {{ padding: 10px; border: 1px solid #ccc; }}
        .header {{ background-color: #b31f24; font-weight: bold; padding: 10px; text-align: center; color: white; font-size: 17px; }}
        .content {{ text-align: left; }}
    </style>
    <body>
        <div style="text-align: center; padding-top: 0.5rem; padding-bottom: 0.5rem;">
            <img src="https://ktechproducts.com/wp-content/uploads/2023/05/Ktech-color-cogo-746-x-156-01.png" width="230" alt="Logo" />
        </div>
        <table>
            <tr class="header-top">
                <td colspan="2" class="header">
                    {system_name} User Registration
                </td>
            </tr>
            <tr>
                <td class="content" colspan="2">
                    <h4 style="text-align: left;">Dear <span style="color: #b31f24;">{name},</span></h4>
                    <p style="margin-bottom: 1rem; text-align: left;">
                        Your Account has been created. Please find below details.
                    </p>
                    <p style="margin-bottom: 1rem;"><strong>Email ID: </strong><span style="color: blue;">{email}</span></p>
                    <p style="margin-bottom: 1rem;">For login please set your password: <a href="{reset_link}"><span style="color: blue;">Click Here</span></a></p>
                    <p>Sincerely yours,</p>
                    <p>The {system_name} Team.</p>
                    <p><strong>{system_name} - Powered by</strong> <a href="https://ktechproducts.com/"><span>www.ktechproducts.com</span></a></p>
                </td>
            </tr>
        </table>
    </body>
    """
    
    return send_email(db, email, subject, html_body)
