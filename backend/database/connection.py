"""
Database connection and session management for PostgreSQL
"""
import os
from pathlib import Path
import urllib.parse

# Load .env from backend directory first so DB_PORT is in os.environ (avoids wrong cwd)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config.settings import settings

# Create connection string for PostgreSQL
# Format: postgresql://user:password@host:port/database
encoded_password = urllib.parse.quote_plus(settings.DB_PASSWORD)
db_host = settings.DB_HOST
# Port: from env first (dotenv above), then settings, then default 5432
db_port = (os.environ.get("DB_PORT") or getattr(settings, "DB_PORT", None) or "").strip() or "5432"
if ":" not in db_host:
    db_host = f"{db_host}:{db_port}"
connection_string = (
    f"postgresql://{settings.DB_USER}:{encoded_password}"
    f"@{db_host}/{settings.DB_NAME}"
)

# Create engine
engine = create_engine(
    connection_string,
    pool_pre_ping=True,  # Verify connections before using them
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=5,         # Pool size
    max_overflow=10,     # Maximum overflow connections
    pool_timeout=30,     # Timeout for getting connection from pool
    echo=settings.DEBUG
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
