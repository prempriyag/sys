"""
FastAPI Main Application
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from controllers import auth_controller, users_controller, theme_settings_controller, sso_controller
from controllers.college import transcriptreports_controller
from controllers.school import school_transcriptreports_controller, school_transcripts_controller

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

# Import viewfile and batchdetails controllers
try:
    from controllers.college import viewfile_controller, batchdetails_controller
    print("[MAIN] Successfully imported viewfile_controller and batchdetails_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing viewfile/batchdetails controllers: {e}")
    import traceback
    traceback.print_exc()
    viewfile_controller = None
    batchdetails_controller = None

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
        "http://localhost:5173",  # React frontend (Vite default port)
        "http://localhost:5174",  # React frontend (Vite alternative port)
        "http://localhost:3000",  # Alternative React port
        "http://127.0.0.1:5173",  # React frontend (127.0.0.1)
        "http://127.0.0.1:5174",  # React frontend (127.0.0.1)
        "http://127.0.0.1:3000",  # Alternative React port (127.0.0.1)
        "https://digiscript-csc-uat.ktechproducts.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import dashboard controller
try:
    from controllers.college import dashboard_controller
    print("[MAIN] Successfully imported dashboard_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing dashboard_controller: {e}")
    import traceback
    traceback.print_exc()
    dashboard_controller = None

    # === ADD THIS ===
# Register dashboard router
if dashboard_controller is not None:
    app.include_router(dashboard_controller.router)
    print("[MAIN] Successfully registered dashboard_controller router")
    # Debug: Print the routes
    for route in dashboard_controller.router.routes:
        print(f"  Route: {route.path}")
else:
    print("[MAIN] WARNING: dashboard_controller not registered")
    

# Include routers
app.include_router(auth_controller.router)
app.include_router(users_controller.router)
app.include_router(theme_settings_controller.router)
app.include_router(transcriptreports_controller.router)
app.include_router(school_transcriptreports_controller.router)

# Include school transcriptreports router if imported successfully
if school_transcriptreports_controller is not None:
    app.include_router(school_transcriptreports_controller.router)
    print("[MAIN] Successfully registered school_transcriptreports_controller router")
else:
    print("[MAIN] WARNING: school_transcriptreports_controller router NOT registered due to import error")

# Import school dashboard controller
try:
    from controllers.school import school_dashboard_controller
    print("[MAIN] Successfully imported school_dashboard_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing school_dashboard_controller: {e}")
    import traceback
    traceback.print_exc()
    school_dashboard_controller = None

# Include school dashboard router if imported successfully
if school_dashboard_controller is not None:
    app.include_router(school_dashboard_controller.router)
    print("[MAIN] Successfully registered school_dashboard_controller router")


# Include SSO router
try:
    from fastapi import APIRouter
    app.include_router(sso_controller.router)
    # Support /api/api/sso/... so OAuth callback works when Azure redirect URI has double /api
    app.include_router(sso_controller.router_double_api)
    # Also include router with /sso prefix (without /api) for unified entry points
    sso_router_short = APIRouter(prefix="/sso", tags=["SSO"])
    # Add routes using add_api_route method
    sso_router_short.add_api_route("/client", sso_controller.client_sso_login, methods=["GET"])
    sso_router_short.add_api_route("/ktech", sso_controller.ktech_sso_login, methods=["GET"])
    app.include_router(sso_router_short)
    print("[MAIN] Successfully registered sso_controller router")
except Exception as e:
    print(f"[MAIN] ERROR registering sso_controller router: {e}")
    import traceback
    traceback.print_exc()


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

# Import transcripts controller
try:
    from backend.controllers.school import school_transcripts_controller
    print("[MAIN] Successfully imported transcripts_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing transcripts_controller: {e}")
    import traceback
    traceback.print_exc()
    school_transcripts_controller = None

# Include transcripts router if imported successfully
if school_transcripts_controller is not None:
    app.include_router(school_transcripts_controller.router)
    print("[MAIN] Successfully registered transcripts_controller router")

# Import stored procedure controller
try:
    from controllers.setup import storedprocedure_controller
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
    from controllers.setup import degreemapping_controller
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
    from controllers.setup import termmapping_controller
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
    from controllers.setup import termnamemapping_controller
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
    from controllers.setup import grademapping_controller
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
    from controllers.setup import skipkeywords_controller
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

# Import all remaining setup controllers
try:
    from controllers.setup import skipcourses_controller, yearmapping_controller
    from controllers.college import botschedule_controller
    from controllers.college import botstatusreport_controller
    from controllers.setup import suffixname_controller, prefixname_controller
    from controllers.setup import combinedname_controller, acceptedgrades_controller, transfergrades_controller
    from controllers.setup import (
        institutionmapping_controller,
        accreditedinstitution_controller,
        overrideeditmapping_controller,
        gpapickmapping_controller,
        gpascalemapping_controller,
    )
    print("[MAIN] Successfully imported remaining setup controllers")
except Exception as e:
    print(f"[MAIN] ERROR importing remaining setup controllers: {e}")
    import traceback
    traceback.print_exc()
    skipcourses_controller = None
    yearmapping_controller = None
    botschedule_controller = None
    botstatusreport_controller = None
    suffixname_controller = None
    prefixname_controller = None
    combinedname_controller = None
    acceptedgrades_controller = None
    transfergrades_controller = None
    institutionmapping_controller = None
    accreditedinstitution_controller = None
    overrideeditmapping_controller = None
    gpapickmapping_controller = None
    gpascalemapping_controller = None

# Register all remaining setup routers
controllers_to_register = [
    (skipcourses_controller, "skipcourses_controller"),
    (yearmapping_controller, "yearmapping_controller"),
    (botschedule_controller, "botschedule_controller"),
    (botstatusreport_controller, "botstatusreport_controller"),
    (suffixname_controller, "suffixname_controller"),
    (prefixname_controller, "prefixname_controller"),
    (combinedname_controller, "combinedname_controller"),
    (acceptedgrades_controller, "acceptedgrades_controller"),
    (transfergrades_controller, "transfergrades_controller"),
    (institutionmapping_controller, "institutionmapping_controller"),
    (accreditedinstitution_controller, "accreditedinstitution_controller"),
    (overrideeditmapping_controller, "overrideeditmapping_controller"),
    (gpapickmapping_controller, "gpapickmapping_controller"),
    (gpascalemapping_controller, "gpascalemapping_controller"),
]

for controller, name in controllers_to_register:
    if controller is not None:
        app.include_router(controller.router)
        print(f"[MAIN] Successfully registered {name} router")

# Include articulation reports router if imported successfully
if articulationreports_controller is not None:
    app.include_router(articulationreports_controller.router)
    print("[MAIN] Successfully registered articulationreports_controller router")
    print(f"[MAIN] Router prefix: {articulationreports_controller.router.prefix}")
    print(f"[MAIN] Routes: {[r.path for r in articulationreports_controller.router.routes]}")
else:
    print("[MAIN] WARNING: articulationreports_controller router NOT registered due to import error")

# Include viewfile and batchdetails routers if imported successfully
if viewfile_controller is not None:
    app.include_router(viewfile_controller.router)
    print("[MAIN] Successfully registered viewfile_controller router")
else:
    print("[MAIN] WARNING: viewfile_controller router NOT registered due to import error")

if batchdetails_controller is not None:
    app.include_router(batchdetails_controller.router)
    print("[MAIN] Successfully registered batchdetails_controller router")
else:
    print("[MAIN] WARNING: batchdetails_controller router NOT registered due to import error")

# Import OCR (ocrverify) module controllers
try:
    from controllers.ocr import (
        dashboard_controller as ocr_dashboard_controller,
        verifier_controller,
        college_ocr_controller,
        college_hdr_controller,
        school_ocr_controller,
        school_hdr_controller,
    )
    print("[MAIN] Successfully imported OCR (ocrverify) controllers")
except Exception as e:
    print(f"[MAIN] ERROR importing OCR controllers: {e}")
    import traceback
    traceback.print_exc()
    ocr_dashboard_controller = None
    verifier_controller = None
    college_ocr_controller = None
    college_hdr_controller = None
    school_ocr_controller = None
    school_hdr_controller = None

# Include OCR routers if imported successfully
ocr_controllers = [
    (ocr_dashboard_controller, "ocr_dashboard_controller"),
    (verifier_controller, "ocr_verifier_controller"),
    (college_ocr_controller, "ocr_college_ocr_controller"),
    (college_hdr_controller, "ocr_college_hdr_controller"),
    (school_ocr_controller, "ocr_school_ocr_controller"),
    (school_hdr_controller, "ocr_school_hdr_controller"),
]
for ctrl, name in ocr_controllers:
    if ctrl is not None:
        app.include_router(ctrl.router)
        print(f"[MAIN] Successfully registered {name} router")

# Import error log controller
try:
    from controllers.college import errorlog_controller
    print("[MAIN] Successfully imported errorlog_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing errorlog_controller: {e}")
    import traceback
    traceback.print_exc()
    errorlog_controller = None

# Include error log router if imported successfully
if errorlog_controller is not None:
    app.include_router(errorlog_controller.router)
    print("[MAIN] Successfully registered errorlog_controller router")

# Import SMTP controller
try:
    from controllers.college import smtp_controller
    print("[MAIN] Successfully imported smtp_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing smtp_controller: {e}")
    import traceback
    traceback.print_exc()
    smtp_controller = None

# Include SMTP router if imported successfully
if smtp_controller is not None:
    app.include_router(smtp_controller.router)
    print("[MAIN] Successfully registered smtp_controller router")

# Import master settings controller
try:
    from controllers.college import mastersettings_controller
    print("[MAIN] Successfully imported mastersettings_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing mastersettings_controller: {e}")
    import traceback
    traceback.print_exc()
    mastersettings_controller = None

# Include master settings router if imported successfully
if mastersettings_controller is not None:
    app.include_router(mastersettings_controller.router)
    print("[MAIN] Successfully registered mastersettings_controller router")

# Import settings controller (SMS and SMTP endpoints)
try:
    from controllers.college import settings_controller
    print("[MAIN] Successfully imported settings_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing settings_controller: {e}")
    import traceback
    traceback.print_exc()
    settings_controller = None

# Include settings router if imported successfully
if settings_controller is not None:
    app.include_router(settings_controller.router)
    print("[MAIN] Successfully registered settings_controller router")

# Import permissions and roles controllers
try:
    from controllers.college import permissions_controller, roles_controller
    print("[MAIN] Successfully imported permissions and roles controllers")
except Exception as e:
    print(f"[MAIN] ERROR importing permissions/roles controllers: {e}")
    import traceback
    traceback.print_exc()
    permissions_controller = None
    roles_controller = None

# Include permissions and roles routers if imported successfully
if permissions_controller is not None:
    app.include_router(permissions_controller.router)
    print("[MAIN] Successfully registered permissions_controller router")
if roles_controller is not None:
    app.include_router(roles_controller.router)
    print("[MAIN] Successfully registered roles_controller router")

# Import studentview controller
try:
    from controllers.college import studentview_controller
    print("[MAIN] Successfully imported studentview_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing studentview_controller: {e}")
    import traceback
    traceback.print_exc()
    studentview_controller = None

# Include studentview router if imported successfully
if studentview_controller is not None:
    app.include_router(studentview_controller.router)
    print("[MAIN] Successfully registered studentview_controller router")

# Import school studentview controller (HS)
try:
    from controllers.school import studentview_controller as school_studentview_controller
    print("[MAIN] Successfully imported school studentview_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing school studentview_controller: {e}")
    import traceback
    traceback.print_exc()
    school_studentview_controller = None

if school_studentview_controller is not None:
    app.include_router(school_studentview_controller.router)
    print("[MAIN] Successfully registered school studentview_controller router")


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
