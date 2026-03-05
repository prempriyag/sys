"""
FastAPI Main Application - SIR Impact Analysis System
"""
import logging
import os
import asyncio
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from starlette.responses import Response


class ForceCORSOriginMiddleware(BaseHTTPMiddleware):
    """Ensure CORS response echoes request Origin for localhost (fixes proxy/cache sending wrong port)."""

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
        except asyncio.CancelledError:
            # Happens on shutdown/reload or client disconnect while a request is in-flight.
            # Return a quiet response to avoid noisy "Exception in ASGI application" logs.
            return Response(status_code=499)
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
    theme_settings_controller,
    permissions_controller, 
    roles_controller,
    notification_controller,
    app_settings_controller,
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
# root_path: when served behind nginx at /backend/, docs/openapi.json must use this base path
app = FastAPI(
    title="SIR Impact Analysis System API",
    description="Backend for SIR Impact Analysis comparing Pre-SIR and Post-SIR electoral rolls.",
    version="1.0.0",
    root_path=os.getenv("ROOT_PATH", ""),  # Set ROOT_PATH=/backend when behind nginx proxy
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
    "http://localhost:8001",
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

def _cors_headers(request: Request) -> dict:
    """Add CORS Allow-Origin for localhost so error responses don't get blocked by browser."""
    origin = request.headers.get("origin")
    if origin and (origin.startswith("http://localhost") or origin.startswith("http://127.0.0.1")):
        return {"Access-Control-Allow-Origin": origin}
    return {}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=_cors_headers(request),
    )

# Ensure unhandled exceptions still return a response with CORS (exception response bypasses middleware).
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logging.exception("Unhandled exception: %s", exc)
    debug = os.getenv("DEBUG", "").strip().lower() in ("1", "true", "yes")
    detail = str(exc) if debug else "Internal server error"
    return JSONResponse(status_code=500, content={"detail": detail}, headers=_cors_headers(request))

# Include Routers
app.include_router(auth_controller.router)
app.include_router(users_controller.router)
app.include_router(roles_controller.router)
app.include_router(permissions_controller.router)
app.include_router(theme_settings_controller.router)
app.include_router(notification_controller.router)
app.include_router(app_settings_controller.router)
app.include_router(mastersettings_controller.router)

# Import and include SIR controllers
from controllers.sir import upload_router, matching_router, kpi_router, dashboard_router, analytics_router
from controllers.sir.validation_controller import router as validation_router
from controllers.sir.reports_controller import router as reports_router
from controllers.sir.extractor_controller import router as extractor_router
from controllers.sir.extract_batch_controller import router as extract_batch_router
from controllers.sir.docling_controller import router as docling_router
from controllers.sir.textract_bulk_controller import router as textract_bulk_router
from bulk_electoral import router as bulk_electoral_router

app.include_router(textract_bulk_router)
app.include_router(extract_batch_router)
app.include_router(bulk_electoral_router)
app.include_router(upload_router)
app.include_router(docling_router)
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


@app.get("/api/extraction-deps")
async def extraction_deps():
    """
    Diagnostic: which Python is running and whether pdfplumber/boto3 are importable.
    Use this to fix 'PDF extraction import failed' or Textract errors.
    """
    import sys
    boto3_ok = False
    pdfplumber_ok = False
    boto3_err = ""
    pdfplumber_err = ""
    try:
        import boto3  # noqa: F401
        boto3_ok = True
    except ImportError as e:
        boto3_err = str(e)
    try:
        import pdfplumber  # noqa: F401
        pdfplumber_ok = True
    except ImportError as e:
        pdfplumber_err = str(e)
    return {
        "python_executable": sys.executable,
        "boto3_available": boto3_ok,
        "pdfplumber_available": pdfplumber_ok,
        "boto3_error": boto3_err or None,
        "pdfplumber_error": pdfplumber_err or None,
        "hint": (
            f"Run: {sys.executable} -m pip install boto3 pdfplumber"
            if not (boto3_ok and pdfplumber_ok)
            else "All extraction deps OK"
        ),
    }

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
