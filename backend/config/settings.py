"""
Configuration settings for the FastAPI application
"""
from pydantic_settings import BaseSettings
from typing import Optional
import os


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
    ENVIRONMENT: str = "DEV"
    DEBUG: bool = True
    # BASE_URL: str = "https://digiscript-csc-uat.ktechproducts.com/api"  # Base URL for SSO redirects
    # FRONTEND_URL: str = "https://digiscript-csc-uat.ktechproducts.com"  # Frontend URL for SSO callbacks
    
    BASE_URL: str = "http://localhost:8000"  # Base URL for SSO redirects
    FRONTEND_URL: str = "http://localhost:5173"  # Frontend URL for SSO callbacks
    
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

