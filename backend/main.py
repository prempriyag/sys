"""
FastAPI Main Application
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from controllers import auth_controller, users_controller
from controllers.college import transcriptreports_controller

# Import digiscript reports controller
try:
    from controllers.college import digiscriptreports_controller
    print("[MAIN] Successfully imported digiscriptreports_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing digiscriptreports_controller: {e}")
    import traceback
    traceback.print_exc()
    digiscriptreports_controller = None

# Import OCR controllers
try:
    from controllers.college import transcripthdrocr_controller, transcriptlineocr_controller
    print("[MAIN] Successfully imported OCR controllers")
except Exception as e:
    print(f"[MAIN] ERROR importing OCR controllers: {e}")
    import traceback
    traceback.print_exc()
    transcripthdrocr_controller = None
    transcriptlineocr_controller = None

# Import DATA controllers
try:
    from controllers.college import transcripthdrdata_controller, transcriptlinedata_controller
    print("[MAIN] Successfully imported DATA controllers")
except Exception as e:
    print(f"[MAIN] ERROR importing DATA controllers: {e}")
    import traceback
    traceback.print_exc()
    transcripthdrdata_controller = None
    transcriptlinedata_controller = None

# Import Audit Log controllers
try:
    from controllers.college import digiscriptbotlog_controller, articulationbotlog_controller
    print("[MAIN] Successfully imported Audit Log controllers")
except Exception as e:
    print(f"[MAIN] ERROR importing Audit Log controllers: {e}")
    import traceback
    traceback.print_exc()
    digiscriptbotlog_controller = None
    articulationbotlog_controller = None

# Import articulation reports controller with error handling
try:
    from controllers.college import articulationreports_controller
    print("[MAIN] Successfully imported articulationreports_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing articulationreports_controller: {e}")
    import traceback
    traceback.print_exc()
    articulationreports_controller = None

# Import all models to ensure SQLAlchemy relationships are configured
# This must happen before any queries are made
from models import User, Role, Permission, RolePermission, BusinessSettings

# Configure logging to show INFO level and above
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

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

# Include digiscript reports router if imported successfully
if digiscriptreports_controller is not None:
    app.include_router(digiscriptreports_controller.router)
    print("[MAIN] Successfully registered digiscriptreports_controller router")

# Include OCR routers if imported successfully
if transcripthdrocr_controller is not None:
    app.include_router(transcripthdrocr_controller.router)
    print("[MAIN] Successfully registered transcripthdrocr_controller router")
if transcriptlineocr_controller is not None:
    app.include_router(transcriptlineocr_controller.router)
    print("[MAIN] Successfully registered transcriptlineocr_controller router")

# Include DATA routers if imported successfully
if transcripthdrdata_controller is not None:
    app.include_router(transcripthdrdata_controller.router)
    print("[MAIN] Successfully registered transcripthdrdata_controller router")
if transcriptlinedata_controller is not None:
    app.include_router(transcriptlinedata_controller.router)
    print("[MAIN] Successfully registered transcriptlinedata_controller router")

# Include Audit Log routers if imported successfully
if digiscriptbotlog_controller is not None:
    app.include_router(digiscriptbotlog_controller.router)
    print("[MAIN] Successfully registered digiscriptbotlog_controller router")
if articulationbotlog_controller is not None:
    app.include_router(articulationbotlog_controller.router)
    print("[MAIN] Successfully registered articulationbotlog_controller router")

# Import transcripts controller
try:
    from controllers.college import transcripts_controller
    print("[MAIN] Successfully imported transcripts_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing transcripts_controller: {e}")
    import traceback
    traceback.print_exc()
    transcripts_controller = None

# Include transcripts router if imported successfully
if transcripts_controller is not None:
    app.include_router(transcripts_controller.router)
    print("[MAIN] Successfully registered transcripts_controller router")

# Import stored procedure controller
try:
    from controllers.college import storedprocedure_controller
    print("[MAIN] Successfully imported storedprocedure_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing storedprocedure_controller: {e}")
    import traceback
    traceback.print_exc()
    storedprocedure_controller = None

# Include stored procedure router if imported successfully
if storedprocedure_controller is not None:
    app.include_router(storedprocedure_controller.router)
    print("[MAIN] Successfully registered storedprocedure_controller router")

# Import degree mapping controller
try:
    from controllers.college import degreemapping_controller
    print("[MAIN] Successfully imported degreemapping_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing degreemapping_controller: {e}")
    import traceback
    traceback.print_exc()
    degreemapping_controller = None

# Include degree mapping router if imported successfully
if degreemapping_controller is not None:
    app.include_router(degreemapping_controller.router)
    print("[MAIN] Successfully registered degreemapping_controller router")

# Import term mapping controller
try:
    from controllers.college import termmapping_controller
    print("[MAIN] Successfully imported termmapping_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing termmapping_controller: {e}")
    import traceback
    traceback.print_exc()
    termmapping_controller = None

# Include term mapping router if imported successfully
if termmapping_controller is not None:
    app.include_router(termmapping_controller.router)
    print("[MAIN] Successfully registered termmapping_controller router")

# Import term name mapping controller
try:
    from controllers.college import termnamemapping_controller
    print("[MAIN] Successfully imported termnamemapping_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing termnamemapping_controller: {e}")
    import traceback
    traceback.print_exc()
    termnamemapping_controller = None

# Include term name mapping router if imported successfully
if termnamemapping_controller is not None:
    app.include_router(termnamemapping_controller.router)
    print("[MAIN] Successfully registered termnamemapping_controller router")

# Import grade mapping controller
try:
    from controllers.college import grademapping_controller
    print("[MAIN] Successfully imported grademapping_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing grademapping_controller: {e}")
    import traceback
    traceback.print_exc()
    grademapping_controller = None

# Include grade mapping router if imported successfully
if grademapping_controller is not None:
    app.include_router(grademapping_controller.router)
    print("[MAIN] Successfully registered grademapping_controller router")

# Import skip keywords controller
try:
    from controllers.college import skipkeywords_controller
    print("[MAIN] Successfully imported skipkeywords_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing skipkeywords_controller: {e}")
    import traceback
    traceback.print_exc()
    skipkeywords_controller = None

# Include skip keywords router if imported successfully
if skipkeywords_controller is not None:
    app.include_router(skipkeywords_controller.router)
    print("[MAIN] Successfully registered skipkeywords_controller router")

# Include articulation reports router if imported successfully
if articulationreports_controller is not None:
    app.include_router(articulationreports_controller.router)
    print("[MAIN] Successfully registered articulationreports_controller router")
    print(f"[MAIN] Router prefix: {articulationreports_controller.router.prefix}")
    print(f"[MAIN] Routes: {[r.path for r in articulationreports_controller.router.routes]}")
else:
    print("[MAIN] WARNING: articulationreports_controller router NOT registered due to import error")


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


@app.get("/db-info")
async def db_info():
    """
    Get database connection information (without sensitive data)
    Useful for debugging which database is connected
    """
    from config.settings import settings
    from database.connection import engine
    
    try:
        # Test connection and get database name
        with engine.connect() as conn:
            result = conn.execute(text("SELECT DB_NAME() as current_db"))
            db_info = result.fetchone()
            current_db = db_info[0] if db_info else "Unknown"
            
            # Get server info
            result = conn.execute(text("SELECT @@SERVERNAME as server_name"))
            server_info = result.fetchone()
            server_name = server_info[0] if server_info else "Unknown"
    except Exception as e:
        return {
            "error": str(e),
            "configured_db": settings.DB_NAME,
            "host": settings.DB_HOST,
            "user": settings.DB_USER,
            "connection_status": "Failed"
        }
    
    return {
        "connection_status": "Connected",
        "configured_database": settings.DB_NAME,
        "actual_database": current_db,
        "server": server_name,
        "host": settings.DB_HOST,
        "user": settings.DB_USER,
        "driver": settings.DB_DRIVER,
        "environment": settings.ENVIRONMENT
    }
