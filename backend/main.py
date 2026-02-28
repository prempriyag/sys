"""
FastAPI Main Application - SIR Impact Analysis System
"""
import logging
import os
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


class ForceCORSOriginMiddleware(BaseHTTPMiddleware):
    """Ensure CORS response echoes request Origin for localhost (fixes proxy/cache sending wrong port)."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        if origin and (
            origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1")
        ):
            response.headers["Access-Control-Allow-Origin"] = origin
        return response

# Import core controllers
from controllers import (
    auth_controller, 
    users_controller, 
    theme_settings_controller
)
from controllers.college import (
    permissions_controller, 
    roles_controller,
    settings_controller,
    mastersettings_controller
)

# Import all models to ensure SQLAlchemy relationships are configured
from models import User, Role, Permission, RolePermission, BusinessSettings
# Import SIR models (ensure they are registered)
from models import sir

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Create FastAPI app
app = FastAPI(
    title="SIR Impact Analysis System API",
    description="Backend for SIR Impact Analysis comparing Pre-SIR and Post-SIR electoral rolls.",
    version="1.0.0"
)

# Static files
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
USERPROFILE_DIR = os.path.join(ASSETS_DIR, "userprofile")
os.makedirs(USERPROFILE_DIR, exist_ok=True)
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# Run first so it runs last on response and can override CORS header (echo request Origin for localhost)
app.add_middleware(ForceCORSOriginMiddleware)

# CORS Configuration – allow any localhost port (5173, 51590, 3000, etc.)
# Include 51590 explicitly (Cursor/VS Code port forwarding often uses this port)
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:51590",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:51590",
    "http://127.0.0.1:8000",
    # UAT server
    "http://65.1.93.82",
    "http://65.1.93.82:80",
]
CORS_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include Routers
app.include_router(auth_controller.router)
app.include_router(users_controller.router)
app.include_router(roles_controller.router)
app.include_router(permissions_controller.router)
app.include_router(theme_settings_controller.router)
app.include_router(settings_controller.router)
app.include_router(mastersettings_controller.router)

# Import and include SIR controllers
from controllers.sir import upload_router, matching_router, kpi_router, dashboard_router, analytics_router
from controllers.sir.validation_controller import router as validation_router
from controllers.sir.reports_controller import router as reports_router
from controllers.sir.extractor_controller import router as extractor_router
from controllers.sir.extract_batch_controller import router as extract_batch_router
from bulk_electoral import router as bulk_electoral_router

app.include_router(extract_batch_router)
app.include_router(bulk_electoral_router)
app.include_router(upload_router)
app.include_router(extractor_router)
app.include_router(matching_router)
app.include_router(kpi_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)
app.include_router(validation_router)
app.include_router(reports_router)

# Optional: start folder watcher on startup when EXTRACT_OCR_FOLDER is set
@app.on_event("startup")
async def startup_event():
    try:
        from services.extract_folder_watcher import start_folder_watcher
        start_folder_watcher()
    except Exception as e:
        logging.getLogger(__name__).debug("Extract folder watcher not started: %s", e)


@app.get("/")
async def root():
    return {
        "message": "SIR Impact Analysis System API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/db-info")
async def db_info():
    """
    Get database connection information
    """
    from config.settings import settings
    from database.connection import engine
    from sqlalchemy import text
    
    try:
        # Test database connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version()"))
            db_version = result.scalar()
        
        # Return database info (without sensitive password)
        return {
            "status": "connected",
            "database": {
                "host": settings.DB_HOST,
                "name": settings.DB_NAME,
                "user": settings.DB_USER,
                "driver": settings.DB_DRIVER if settings.DB_DRIVER else "PostgreSQL (psycopg2)",
                "version": db_version if db_version else "Unknown"
            },
            "connection": "success"
        }
    except Exception as e:
        return {
            "status": "error",
            "database": {
                "host": settings.DB_HOST,
                "name": settings.DB_NAME,
                "user": settings.DB_USER,
                "driver": settings.DB_DRIVER if settings.DB_DRIVER else "PostgreSQL (psycopg2)"
            },
            "connection": "failed",
            "error": str(e)
        }