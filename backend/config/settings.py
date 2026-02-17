"""
Configuration settings for the FastAPI application
"""
from pydantic_settings import BaseSettings
from pydantic import model_validator
from typing import Optional

# Default BASE_URL (origin for SSO) and FRONTEND_URL per environment (override with env vars)
# UAT/PROD: backend at {origin}/backend, frontend at {origin}
_ENV_URLS = {
    "DEV": ("http://localhost:8000", "http://localhost:5173"),
    "UAT": (
        "https://digiscript-csc-uat.ktechproducts.com/backend",
        "https://digiscript-csc-uat.ktechproducts.com",
    ),
    "PROD": (
        "https://digiscript-csc.ktechproducts.com/backend",
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
    DB_PORT: Optional[str] = None  # Optional port for PostgreSQL (defaults to 5432)
    DB_DRIVER: Optional[str] = None  # Only needed for SQL Server, not PostgreSQL
    # DB_DRIVER: str = "ODBC Driver 18 for SQL Server"
    # DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    
    # JWT Configuration
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # Application Configuration
    ENVIRONMENT: str = "DEV"  # DEV | UAT | PROD
    DEBUG: bool = True
    
    # Profiling Configuration (matches CI3 enable_profiler)
    # When False, no profiling logic runs at all (zero overhead)
    ENABLE_PROFILING: bool = True
    
    # Optional overrides; if not set, defaults from _ENV_URLS are used per ENVIRONMENT
    BASE_URL: Optional[str] = None   # Backend base URL for SSO redirects
    FRONTEND_URL: Optional[str] = None  # Frontend URL for SSO callbacks

    # Path / share config - build paths in code like CI3 config.php (avoids .env backslash escaping)
    # SHARE_HOST + HOT_FOLDER have no backslashes, so .env is safe
    SHARE_HOST: str = "172.16.2.22"
    HOT_FOLDER: str = "osucsc_dev"
    HOT_PATH: str = "OSUCSC"
    IS_UBUNTU: bool = False
    SHARE_PATH_UBUNTU: Optional[str] = None
    SHARE_PATH: Optional[str] = None  # Built in validator, ignore if in .env
    SHARE_PATH_REPLACE: Optional[str] = None  # Built in validator
    # Optional: override transcript sources path for local dev when network share unreachable
    TRANSCRIPTS_COLLEGE_PATH: Optional[str] = None

    # Institution labels
    INS_NAME: str = "OSUCSC"
    STUDENT_LABEL: str = "OSUCSC"

    @model_validator(mode="after")
    def set_default_urls_by_env(self):
        env = (self.ENVIRONMENT or "DEV").upper()
        base, front = _ENV_URLS.get(env, _ENV_URLS["DEV"])
        if self.BASE_URL is None or self.BASE_URL.strip() == "":
            object.__setattr__(self, "BASE_URL", base)
        if self.FRONTEND_URL is None or self.FRONTEND_URL.strip() == "":
            object.__setattr__(self, "FRONTEND_URL", front)
        # Build SHARE_PATH in code like CI3 config.php - avoids .env backslash escaping
        host = (self.SHARE_HOST or "172.16.2.22").strip()
        folder = (self.HOT_FOLDER or "osucsc_dev").strip()
        object.__setattr__(self, "SHARE_PATH", f"\\\\{host}\\{folder}\\")
        object.__setattr__(self, "SHARE_PATH_REPLACE", f"//{host}/{folder}/")
        if not self.SHARE_PATH_UBUNTU or (isinstance(self.SHARE_PATH_UBUNTU, str) and self.SHARE_PATH_UBUNTU.strip() == ""):
            object.__setattr__(self, "SHARE_PATH_UBUNTU", f"/mnt/digiscript-uat/{folder}/")
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

