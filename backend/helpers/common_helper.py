"""
Common helper functions
Based on common_helper.php from CodeIgniter
"""
import hashlib
import re
import random
import string
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy import text
from models import User, BusinessSettings


def generate_rand_number(length: int = 0) -> str:
    """
    Generate a random number for password generation
    Based on generateRandNumber() from common_helper.php
    """
    characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    random_string = ''.join(random.choice(characters) for _ in range(length))
    return random_string.lower()


def get_data(db: Session, table: str, where: Optional[Dict] = None, 
             select: Optional[List[str]] = None, limit: Optional[int] = None):
    """
    Get data from table
    Based on get_data() from common_helper.php
    """
    query = db.query(table)
    if where:
        query = query.filter_by(**where)
    if select:
        query = query.with_entities(*[getattr(table, col) for col in select])
    if limit:
        query = query.limit(limit)
    return query


def time_ago(date_time: str) -> str:
    """
    Get time ago string
    Based on time_ago() from common_helper.php
    """
    if not date_time:
        return "Last seen 0 sec ago"
    
    date1 = datetime.strptime(date_time, '%Y-%m-%d %H:%M:%S') if isinstance(date_time, str) else date_time
    date2 = datetime.now()
    
    if date1 > date2:
        return "Last seen 0 sec ago"
    
    diff = date2 - date1
    
    if diff.days > 0:
        if diff.days >= 365:
            years = diff.days // 365
            return f"Last seen {years} {'year' if years == 1 else 'years'} ago"
        elif diff.days >= 30:
            months = diff.days // 30
            return f"Last seen {months} {'month' if months == 1 else 'months'} ago"
        else:
            return f"Last seen {diff.days} {'day' if diff.days == 1 else 'days'} ago"
    elif diff.seconds >= 3600:
        hours = diff.seconds // 3600
        return f"Last seen {hours} {'hour' if hours == 1 else 'hours'} ago"
    elif diff.seconds >= 60:
        minutes = diff.seconds // 60
        return f"Last seen {minutes} {'min' if minutes == 1 else 'mins'} ago"
    else:
        return f"Last seen {diff.seconds} sec ago"


def pr(data: Any) -> str:
    """
    Pretty print data (for debugging)
    Based on pr() from common_helper.php
    """
    import json
    return json.dumps(data, indent=2, default=str)


def get_months(from_date: str, to_date: str) -> int:
    """
    Get number of months between two dates
    Based on getMonths() from common_helper.php
    """
    date1 = datetime.strptime(from_date, '%Y-%m-%d')
    date2 = datetime.strptime(to_date, '%Y-%m-%d')
    diff = (date2.year - date1.year) * 12 + (date2.month - date1.month)
    return abs(diff)


def get_years(from_date: str, to_date: str) -> int:
    """
    Get number of years between two dates
    Based on getYears() from common_helper.php
    """
    date1 = datetime.strptime(from_date, '%Y-%m-%d')
    date2 = datetime.strptime(to_date, '%Y-%m-%d')
    return abs(date2.year - date1.year)


def upr2lwr(data: str) -> str:
    """
    Convert string to title case
    Based on upr2lwr() from common_helper.php
    """
    if not data:
        return ""
    return data.title()


def date_format(data: Optional[Union[str, datetime]]) -> Optional[str]:
    """
    Format date as m/d/Y
    Based on dateFormat() from common_helper.php
    """
    if not data:
        return None
    if isinstance(data, str):
        dt = datetime.strptime(data, '%Y-%m-%d')
    else:
        dt = data
    return dt.strftime('%m/%d/%Y')


def date_format_with_time(data: Optional[Union[str, datetime]]) -> Optional[str]:
    """
    Format date with time as m/d/Y h:i:sa
    Based on dateFormatwithtime() from common_helper.php
    """
    if not data:
        return None
    if isinstance(data, str):
        dt = datetime.strptime(data, '%Y-%m-%d %H:%M:%S')
    else:
        dt = data
    return dt.strftime('%m/%d/%Y %I:%M:%S%p').lower()


def ymd_date_format(data: Optional[Union[str, datetime]]) -> Optional[str]:
    """
    Format date as Y-m-d
    Based on YmddateFormat() from common_helper.php
    """
    if not data:
        return None
    if isinstance(data, str):
        dt = datetime.strptime(data, '%Y-%m-%d')
    else:
        dt = data
    return dt.strftime('%Y-%m-%d')


def get_table_data(db: Session, table: Any, field: str = '', where: Optional[Dict] = None) -> Union[Dict, str, None]:
    """
    Get table data
    Based on gettabledata() from common_helper.php
    """
    query = db.query(table)
    if where:
        query = query.filter_by(**where)
    
    result = query.first()
    
    if not result:
        return '' if field else None
    
    if field:
        return getattr(result, field, '')
    
    return result


def change_date_format(format_str: str, original_date: Union[str, datetime]) -> str:
    """
    Change date format
    Based on changeDateFormat() from common_helper.php
    """
    if isinstance(original_date, str):
        dt = datetime.strptime(original_date, '%Y-%m-%d')
    else:
        dt = original_date
    
    # Convert PHP format to Python format
    format_str = format_str.replace('d', '%d').replace('m', '%m').replace('Y', '%Y')
    return dt.strftime(format_str)


def get_between_dates(start_date: str, end_date: str) -> List[str]:
    """
    Get array of dates between start and end date
    Based on getBetweenDates() from common_helper.php
    """
    date_range = []
    start = datetime.strptime(start_date, '%Y-%m-%d')
    end = datetime.strptime(end_date, '%Y-%m-%d')
    
    current = start
    while current <= end:
        date_range.append(current.strftime('%Y-%m-%d'))
        current += timedelta(days=1)
    
    return date_range


def get_months_slab(start_date: str, end_date: str) -> List[Dict[str, Any]]:
    """
    Get months slab between two dates
    Based on getMonthsSlab() from common_helper.php
    """
    from dateutil.relativedelta import relativedelta
    
    date_start = datetime.strptime(start_date, '%Y-%m-%d')
    date_fin = datetime.strptime(end_date, '%Y-%m-%d')
    
    # Calculate total months
    total_months = (date_fin.year - date_start.year) * 12 + (date_fin.month - date_start.month)
    
    result = []
    current = date_start
    
    for i in range(total_months + 1):
        if i == 0:
            first_day = current.strftime('%Y/%m/%d')
        else:
            # Move to first day of next month
            current = current + relativedelta(months=1)
            current = current.replace(day=1)
            first_day = current.strftime('%Y/%m/%d')
        
        if i == total_months:
            last_day = date_fin.strftime('%Y/%m/%d')
        else:
            # Last day of current month
            if current.month == 12:
                last_day = current.replace(year=current.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                last_day = current.replace(month=current.month + 1, day=1) - timedelta(days=1)
            last_day = last_day.strftime('%Y/%m/%d')
        
        # Calculate total days
        first_day_obj = datetime.strptime(first_day, '%Y/%m/%d')
        last_day_obj = datetime.strptime(last_day, '%Y/%m/%d')
        total_days = (last_day_obj - first_day_obj).days
        if current.day == 1:
            total_days += 1
        
        result.append({
            'StartDate': first_day,
            'EndDate': last_day,
            'TotalDays': total_days
        })
    
    return result


def number_of_days(from_date: str, to_date: str) -> str:
    """
    Get number of days between two dates
    Based on numberofdays() from common_helper.php
    """
    date1_ts = datetime.strptime(from_date, '%Y-%m-%d')
    date2_ts = datetime.strptime(to_date, '%Y-%m-%d')
    diff = (date2_ts - date1_ts).total_seconds()
    
    date_diff = abs(int(diff / 86400))
    
    if date_diff == 0:
        hours_diff = abs(int(diff / 3600))
        if hours_diff == 0:
            minutes_diff = abs(int(diff / 60))
            return f"{minutes_diff} Minutes"
        return f"{hours_diff} Hours"
    
    return f"{date_diff} Days"


def check_special_name(name: str) -> str:
    """
    Check and escape special characters in name
    Based on checkspecialname() from common_helper.php
    """
    if "'" in name:
        return name.replace("'", "''")
    return name


def sanitize_for_json(data: Any) -> Any:
    """
    Sanitize data for JSON encoding
    Based on sanitizeForJson() from common_helper.php
    """
    if isinstance(data, dict):
        return {k: sanitize_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_for_json(item) for item in data]
    elif isinstance(data, str):
        # Ensure valid UTF-8
        try:
            data.encode('utf-8')
            return data
        except UnicodeEncodeError:
            return data.encode('utf-8', errors='ignore').decode('utf-8')
    return data


def sanitize_string(input_filename: str) -> str:
    """
    Sanitize string for filename
    Based on sanitizeString() from common_helper.php
    """
    # Convert to ASCII, remove special characters
    normalized = input_filename.encode('ascii', errors='ignore').decode('ascii')
    # Remove special characters except letters, numbers, dashes, underscores, spaces
    normalized = re.sub(r'[^A-Za-z0-9\-_ ]', '', normalized)
    # Replace spaces and dots with dashes
    normalized = re.sub(r'[ .]+', '-', normalized)
    # Trim extra dashes
    normalized = normalized.strip('-')
    return normalized


def password_form_validation(password: str) -> bool:
    """
    Validate password format
    Based on passwordFormValidation() from common_helper.php
    """
    uppercase = bool(re.search(r'[A-Z]', password))
    lowercase = bool(re.search(r'[a-z]', password))
    number = bool(re.search(r'[0-9]', password))
    special_chars = bool(re.search(r'[^\w]', password))
    
    if not uppercase or not lowercase or not number or not special_chars or len(password) < 8:
        return False
    return True


# ---------------------------------------------------------------------------
# updatePathToProcess  (CI3 common_helper.php)
# ---------------------------------------------------------------------------
import logging as _logging

_ftp_logger = _logging.getLogger("helpers.common_helper.ftp")


def _convert_ftp_to_share_path(ftp_path: str, batch_id: str) -> str:
    """
    Generic conversion of an FTP FILE_PATH to a network-share "Processed" path.

    Example input:
        ftp://10.128.144.48/csc_uat/CSC_COLLEGE_TRANSCRIPT/ToBeProcessed/Scanned/transcript.pdf
    Example output:
        //10.128.144.48/csc_uat/CSC_COLLEGE_TRANSCRIPT/Processed/Scanned/Batch HF_ID2619977/transcript.pdf

    Logic (mirrors the CI3 HDR_FILE_PATH_UPDATE SQL):
      1. Strip the ``ftp:`` prefix  → ``//host/folder/.../ToBeProcessed/rest``
      2. Replace ``/ToBeProcessed/`` with ``/Processed/``
      3. In the portion after ``/Processed/``, replace every ``/`` with
         ``/Batch HF_ID{BATCH_ID}/`` (so a sub-folder is inserted before the
         filename).
    """
    if not ftp_path:
        return ftp_path

    # Step 1 – strip "ftp:" prefix
    path = ftp_path
    if path.lower().startswith("ftp:"):
        path = path[4:]  # "ftp://host/..." -> "//host/..."

    # Step 2 – swap ToBeProcessed → Processed
    tbp = "/ToBeProcessed/"
    idx = path.find(tbp)
    if idx == -1:
        # No "ToBeProcessed" segment – nothing to convert
        _ftp_logger.warning(
            "_convert_ftp_to_share_path: no /ToBeProcessed/ in path %r", ftp_path
        )
        return path

    prefix = path[: idx + len("/Processed/")]  # keep up to ".../Processed/"
    prefix = path[: idx] + "/Processed/"
    rest = path[idx + len(tbp):]  # everything after ToBeProcessed/

    # Step 3 – in the "rest" portion, insert "Batch HF_ID{BATCH_ID}/" before
    # the filename.  CI3 does REPLACE(rest, '/', '/Batch HF_ID'+BATCH_ID+'/')
    # which means every "/" in `rest` gets the batch folder inserted.
    if "/" in rest:
        rest = rest.replace("/", f"/Batch HF_ID{batch_id}/")
    else:
        # rest is just a filename – prepend the batch folder
        rest = f"Batch HF_ID{batch_id}/{rest}"

    converted = prefix + rest
    _ftp_logger.info(
        "_convert_ftp_to_share_path: %r -> %r", ftp_path, converted
    )
    return converted


def update_path_to_process(db: Session) -> bool:
    """
    Bulk-convert FTP-prefixed FILE_PATH values in TRANSCRIPT_HDR_OCR.

    First tries the CI3 ``HDR_FILE_PATH_UPDATE`` SQL (works when .env host/
    folder values match the database).  Then does a generic Python fallback
    for any remaining ``ftp:`` rows so it works even when the .env values
    differ from what the database contains.

    Also back-fills empty BATCH_ID on TRANSCRIPT_DOWNLOAD.
    """
    from config.constants import (
        HDR_FILE_PATH_UPDATE,
        TBL_DOWNLOAD,
        TBL_TRANSCRIPTHDROCR,
    )

    try:
        # ---- Step 1: CI3 SQL-based bulk update (fast, but host-specific) ----
        _ftp_logger.info("update_path_to_process: running HDR_FILE_PATH_UPDATE ...")
        result = db.execute(text(HDR_FILE_PATH_UPDATE))
        _ftp_logger.info(
            "update_path_to_process: HDR_FILE_PATH_UPDATE affected %s row(s)",
            result.rowcount,
        )

        # ---- Step 2: generic fallback for rows the SQL missed ----
        remaining = db.execute(
            text(
                f"SELECT BATCH_ID, FILE_PATH FROM {TBL_TRANSCRIPTHDROCR} "
                f"WHERE FILE_PATH LIKE 'ftp:%'"
            )
        ).fetchall()

        if remaining:
            _ftp_logger.info(
                "update_path_to_process: %d row(s) still have ftp: paths – applying Python fallback",
                len(remaining),
            )
            for row in remaining:
                bid = str(row.BATCH_ID)
                old_path = row.FILE_PATH or ""
                new_path = _convert_ftp_to_share_path(old_path, bid)
                if new_path and new_path != old_path:
                    db.execute(
                        text(
                            f"UPDATE {TBL_TRANSCRIPTHDROCR} "
                            f"SET FILE_PATH = :new_path WHERE BATCH_ID = :bid"
                        ),
                        {"new_path": new_path, "bid": bid},
                    )
            _ftp_logger.info("update_path_to_process: Python fallback applied")

        # ---- Step 3: back-fill missing BATCH_ID on TRANSCRIPT_DOWNLOAD ----
        batch_miss_sql = f"""
            UPDATE DOWN
            SET  DOWN.BATCH_ID = H.BATCH_ID
            FROM [dbo].[{TBL_DOWNLOAD}] DOWN, {TBL_TRANSCRIPTHDROCR} H
            WHERE  upper(right(H.FILE_PATH, CHARINDEX('/', REVERSE(H.FILE_PATH), 1) - 1))
                   = UPPER(DOWN.FORMATTED_FILENAME)
               AND CHARINDEX('/', REVERSE(H.FILE_PATH), 1) - 1 > 0
               AND ISNULL(DOWN.BATCH_ID, '') = ''
        """
        result2 = db.execute(text(batch_miss_sql))
        _ftp_logger.info(
            "update_path_to_process: batch_miss affected %s row(s)", result2.rowcount
        )

        db.commit()
        _ftp_logger.info("update_path_to_process: committed successfully")
        return True
    except Exception as e:
        _ftp_logger.error("update_path_to_process FAILED: %s", e, exc_info=True)
        db.rollback()
        return False


def build_transcript_url(db: Session, file_path: str, batch_id: str, project_id: int) -> str:
    """
    Given a FILE_PATH from TRANSCRIPT_HDR_OCR, return a URL string for the
    ``/api/viewfile/transcript_file?pdf=…`` endpoint.

    If the FILE_PATH still starts with ``ftp:``, this function converts it
    to a network-share path (updating the DB), then encrypts it.

    Returns an empty string when no valid URL can be built.
    """
    from config.constants import TBL_TRANSCRIPTHDROCR

    if not file_path:
        return ""

    # If the path is an FTP URL, convert it
    if file_path.lower().startswith("ftp:"):
        _ftp_logger.info(
            "build_transcript_url: batch=%s has ftp path %r",
            batch_id, file_path,
        )

        # Try the bulk SQL + generic fallback
        update_path_to_process(db)

        # Re-read the (now corrected) FILE_PATH for this specific batch
        row = db.execute(
            text(
                f"SELECT FILE_PATH FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) "
                f"WHERE BATCH_ID = :bid AND PROJECT_ID = :pid"
            ),
            {"bid": batch_id, "pid": project_id},
        ).fetchone()
        file_path = (row.FILE_PATH if row else "") or ""
        _ftp_logger.info(
            "build_transcript_url: batch=%s updated FILE_PATH = %r",
            batch_id, file_path,
        )

        if not file_path or file_path.lower().startswith("ftp:"):
            _ftp_logger.warning(
                "build_transcript_url: batch=%s path still ftp after update!",
                batch_id,
            )
            return ""

    if not file_path:
        return ""

    try:
        from helpers.encryption_helper import get_encrypt_file_path

        encrypted = get_encrypt_file_path(file_path)
        url = f"/api/viewfile/transcript_file?pdf={encrypted}"
        _ftp_logger.info("build_transcript_url: batch=%s url built OK", batch_id)
        return url
    except Exception as e:
        _ftp_logger.error("build_transcript_url encrypt failed: %s", e, exc_info=True)
        return ""

