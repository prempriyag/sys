"""
Database connection and session management for PostgreSQL
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config.settings import settings
import urllib.parse

# Create connection string for PostgreSQL
# Format: postgresql://user:password@host:port/database
# Encode password to handle special characters
encoded_password = urllib.parse.quote_plus(settings.DB_PASSWORD)
# Support optional port in DB_HOST or use DB_PORT if provided
db_host = settings.DB_HOST
# Check if port is already in host or use DB_PORT
if ':' not in db_host:
    if hasattr(settings, 'DB_PORT') and settings.DB_PORT:
        db_host = f"{db_host}:{settings.DB_PORT}"
    # PostgreSQL default port is 5432, but we'll let psycopg2 handle it if not specified
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
