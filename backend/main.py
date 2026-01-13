"""
FastAPI Main Application
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from controllers import auth_controller, users_controller, transcriptreports_controller

# Import all models to ensure SQLAlchemy relationships are configured
# This must happen before any queries are made
from models import User, Role, Permission, RolePermission, BusinessSettings

# Create FastAPI app
app = FastAPI(
    title="OSUCSC API",
    description="FastAPI backend for OSUCSC portal",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5174",  # React frontend (Vite default port)
        "http://localhost:3000",  # Alternative React port
        "http://127.0.0.1:5174",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_controller.router)
app.include_router(users_controller.router)
app.include_router(transcriptreports_controller.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "OSUCSC API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
