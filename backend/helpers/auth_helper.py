"""
Authentication helper functions
"""
import hashlib
import re
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from config.settings import settings


def hash_password(password: str) -> str:
    """
    Hash password using SHA256 (matching CodeIgniter implementation)
    """
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password against hash
    """
    return hash_password(plain_password) == hashed_password


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """
    Verify and decode JWT token
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def password_form_validation(password: str) -> bool:
    """
    Validate password format - at least 8 characters with uppercase, lowercase, number, and special character
    Based on passwordFormValidation() from common_helper.php
    """
    uppercase = re.search(r'[A-Z]', password)
    lowercase = re.search(r'[a-z]', password)
    number = re.search(r'[0-9]', password)
    special_chars = re.search(r'[^\w]', password)
    
    if not uppercase or not lowercase or not number or not special_chars or len(password) < 8:
        return False
    return True



