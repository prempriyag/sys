"""
Authentication schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    """Login request schema"""
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=15)


class VerifyCodeRequest(BaseModel):
    """Two-way verification code request schema"""
    verifycode: str = Field(..., min_length=1, max_length=10)


class UserResponse(BaseModel):
    """User response schema"""
    id: int
    name: str
    email: str
    role_id: int
    status: int
    college_perm: int
    hs_perm: int
    ocr_perm: int
    last_login: Optional[datetime] = None
    permissions: Optional[dict] = None  # User permissions dictionary
    
    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Login response schema"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
    permissions: Optional[dict] = None  # User permissions for frontend


class MessageResponse(BaseModel):
    """Generic message response schema"""
    message: str
    success: bool = True


class ForgotPasswordRequest(BaseModel):
    """Forgot password - request reset link"""
    email: EmailStr


class ForgotPasswordResetRequest(BaseModel):
    """Forgot password - reset with token"""
    token: str = Field(..., min_length=1)
    npassword: str = Field(..., min_length=8, max_length=15)
    cpassword: str = Field(..., min_length=8, max_length=15)

