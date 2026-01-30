"""
Database connection and session management for MSSQL
"""
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config.settings import settings

# URL-encode password and username to handle special characters
# DO NOT encode host - it contains backslash for instance name (e.g., 172.16.2.34\SQL2014)
encoded_user = quote_plus(settings.DB_USER)
encoded_password = quote_plus(settings.DB_PASSWORD)
# Driver name: replace spaces with + for URL encoding
encoded_driver = settings.DB_DRIVER.replace(' ', '+')

# Create connection string for MSSQL
# Format: mssql+pyodbc://user:password@host/database?driver=Driver+Name&param=value
# Note: Host should NOT be URL-encoded as it may contain backslashes for instance names
connection_string = (
    f"mssql+pyodbc://{encoded_user}:{encoded_password}"
    f"@{settings.DB_HOST}/{settings.DB_NAME}"
    f"?driver={encoded_driver}"
    "&TrustServerCertificate=yes"
    "&timeout=10"  # Connection timeout in seconds
    "&Connection Timeout=10"  # Alternative timeout parameter
)

# Create engine with additional connection pool settings
# Note: For pyodbc, connection timeout parameters should be in the URL string above
engine = create_engine(
    connection_string,
    pool_pre_ping=True,  # Verify connections before using them (helps with stale connections)
    pool_recycle=3600,   # Recycle connections after 1 hour
    pool_size=5,         # Reduced pool size to avoid too many connections
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

