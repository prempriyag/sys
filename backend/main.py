"""
FastAPI Main Application - SIR Impact Analysis System
"""
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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

# CORS Configuration – use built-in middleware so preflight gets correct Allow-Origin
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
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

app.include_router(upload_router)
app.include_router(matching_router)
app.include_router(kpi_router)
app.include_router(dashboard_router)
app.include_router(analytics_router)

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