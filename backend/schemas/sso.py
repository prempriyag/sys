"""
SSO Schemas for SAML and OAuth
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel


class SSOLoginResponse(BaseModel):
    """SSO Login Response"""
    status: int
    message: str
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    user: Optional[Dict[str, Any]] = None
    permissions: Optional[Dict[str, Any]] = None
    sso_type: Optional[str] = None
    redirect_url: Optional[str] = None


class OAuthCallbackRequest(BaseModel):
    """OAuth Callback Request"""
    code: Optional[str] = None
    state: Optional[str] = None
    error: Optional[str] = None
    error_description: Optional[str] = None


class SAMLCallbackRequest(BaseModel):
    """SAML Callback Request"""
    SAMLResponse: Optional[str] = None
    RelayState: Optional[str] = None


class SSOLogoutResponse(BaseModel):
    """SSO Logout Response"""
    status: int
    message: str
    redirect_url: Optional[str] = None
