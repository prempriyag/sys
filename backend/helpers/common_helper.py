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



