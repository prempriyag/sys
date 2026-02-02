"""
Configuration settings for the FastAPI application
"""
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional
import os

# Default BASE_URL (origin for SSO) and FRONTEND_URL per environment (override with env vars)
# UAT/PROD: backend at {origin}/api, frontend at {origin}
_ENV_URLS = {
    "DEV": ("http://localhost:8000", "http://localhost:5173"),
    "UAT": (
        "https://digiscript-csc-uat.ktechproducts.com",
        "https://digiscript-csc-uat.ktechproducts.com",
    ),
    "PROD": (
        "https://digiscript-csc.ktechproducts.com",
        "https://digiscript-csc.ktechproducts.com",
    ),
}


class Settings(BaseSettings):
    """Application settings"""
    
    # Database Configuration
    DB_HOST: str
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str
    # DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    
    # JWT Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Application Configuration
    ENVIRONMENT: str = "DEV"  # DEV | UAT | PROD
    DEBUG: bool = True
    
    # Optional overrides; if not set, defaults from _ENV_URLS are used per ENVIRONMENT
    BASE_URL: Optional[str] = None   # Backend base URL for SSO redirects
    FRONTEND_URL: Optional[str] = None  # Frontend URL for SSO callbacks
    
    @model_validator(mode="after")
    def set_default_urls_by_env(self):
        env = (self.ENVIRONMENT or "DEV").upper()
        base, front = _ENV_URLS.get(env, _ENV_URLS["DEV"])
        if self.BASE_URL is None or self.BASE_URL.strip() == "":
            object.__setattr__(self, "BASE_URL", base)
        if self.FRONTEND_URL is None or self.FRONTEND_URL.strip() == "":
            object.__setattr__(self, "FRONTEND_URL", front)
        return self
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        # Reload .env file on changes
        extra = "ignore"


# Create settings instance
# Note: Pydantic Settings loads .env file at import time
# For .env changes to take effect, the server needs to reload
# Uvicorn's --reload will restart the server when .env changes
settings = Settings()

