"""
FastAPI Main Application
"""
import logging
import os
from typing import Optional
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
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

# Static files for user profile images and other assets
# Create static/assets directory if it doesn't exist
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
USERPROFILE_DIR = os.path.join(ASSETS_DIR, "userprofile")
os.makedirs(USERPROFILE_DIR, exist_ok=True)

# Mount static files for assets (user profile images, etc.)
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

# CORS: one middleware, set Access-Control-Allow-Origin to request Origin when allowed (local + server)
import re

_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "https://digiscript-csc-uat.ktechproducts.com",
    "https://digiscript-csc.ktechproducts.com",
]
_CORS_ORIGIN_REGEX = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")

def _cors_origin_allowed(origin: str) -> bool:
    if not origin:
        return False
    if origin in _CORS_ORIGINS:
        return True
    return bool(_CORS_ORIGIN_REGEX.match(origin))

class _CORSMiddleware(BaseHTTPMiddleware):
    """Set CORS headers with Access-Control-Allow-Origin = request Origin when allowed."""
    async def dispatch(self, request, call_next):
        origin = request.headers.get("origin")
        if request.method == "OPTIONS":
            # Preflight: 200 with CORS headers; origin must match request
            r = Response(status_code=200)
        else:
            r = await call_next(request)
        if origin and _cors_origin_allowed(origin):
            r.headers["Access-Control-Allow-Origin"] = origin
            r.headers["Access-Control-Allow-Credentials"] = "true"
            r.headers["Access-Control-Expose-Headers"] = "*, X-Process-Time-ms"
            if request.method == "OPTIONS":
                r.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                r.headers["Access-Control-Allow-Headers"] = "*"
                r.headers["Access-Control-Max-Age"] = "600"
        return r

app.add_middleware(_CORSMiddleware)


def _get_header(scope: dict, name: str) -> Optional[str]:
    """Get a single header value from ASGI scope (case-insensitive)."""
    name_lower = name.encode().lower()
    for key, value in scope.get("headers", []):
        if key.lower() == name_lower:
            return value.decode("latin-1").strip()
    return None


class _ProxyHeadersMiddleware:
    """Trust X-Forwarded-Proto and X-Forwarded-Host when request is from 127.0.0.1 (behind nginx)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("client"):
            try:
                client_host = scope["client"][0]
                if isinstance(client_host, bytes):
                    client_host = client_host.decode("utf-8")
            except (IndexError, TypeError):
                client_host = None
            if client_host == "127.0.0.1":
                proto = _get_header(scope, "x-forwarded-proto")
                host = _get_header(scope, "x-forwarded-host")
                if proto and proto.lower() in ("https", "http") or host:
                    scope = dict(scope)
                    if proto and proto.lower() in ("https", "http"):
                        scope["scheme"] = proto.lower()
                    if host:
                        port = 443 if (scope.get("scheme") or "").lower() == "https" else 80
                        scope["server"] = (host, port)
        await self.app(scope, receive, send)


app.add_middleware(_ProxyHeadersMiddleware)

# ==================== PROFILER MIDDLEWARE ====================
# Captures database queries and timing per request (like CI3 MY_Profiler)
# Controlled by ENABLE_PROFILING env var. When False, middleware is a no-op.
from helpers.profiler_helper import (
    PROFILING_ENABLED,
    start_request_profiler,
    end_request_profiler,
    setup_query_profiling,
    is_ktech_user,
)
from database.connection import engine

# Setup SQLAlchemy query profiling (no-op when ENABLE_PROFILING=False)
setup_query_profiling(engine)


class _ProfilerMiddleware(BaseHTTPMiddleware):
    """Middleware to capture profiler data per request for KTech users.
    Adds X-Process-Time-ms response header when profiling is enabled.
    When ENABLE_PROFILING=False, simply passes the request through.
    """

    async def dispatch(self, request, call_next):
        # Fast path: profiling disabled - zero overhead
        if not PROFILING_ENABLED:
            return await call_next(request)

        path = request.url.path
        # Only profile /api/ requests (skip static assets)
        if not path.startswith("/api/"):
            return await call_next(request)

        # Determine if AJAX request
        is_ajax = request.headers.get("x-requested-with", "").lower() == "xmlhttprequest"

        # Try to get user_id from JWT token
        user_id = None
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            try:
                from helpers.auth_helper import verify_token
                token = auth_header[7:]
                payload = verify_token(token)
                if payload:
                    user_id = payload.get("user_id")
            except Exception:
                pass

        # Start profiler
        start_request_profiler(
            uri=path,
            method=request.method,
            is_ajax=is_ajax,
            user_id=user_id,
        )

        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            # End profiler and get total time
            total_ms = end_request_profiler(user_id, status_code=status_code)
            # Inject X-Process-Time-ms header
            if total_ms is not None:
                response.headers["X-Process-Time-ms"] = str(round(total_ms, 2))
            return response
        except Exception:
            end_request_profiler(user_id, status_code=status_code)
            raise

app.add_middleware(_ProfilerMiddleware)
print(f"[MAIN] Profiler middleware {'ENABLED' if PROFILING_ENABLED else 'DISABLED (ENABLE_PROFILING=False)'}")

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

# Import profiler controller (for debugging - KTech users only)
try:
    from controllers import profiler_controller
    print("[MAIN] Successfully imported profiler_controller")
except Exception as e:
    print(f"[MAIN] ERROR importing profiler_controller: {e}")
    import traceback
    traceback.print_exc()
    profiler_controller = None

if profiler_controller is not None:
    app.include_router(profiler_controller.router)
    print("[MAIN] Successfully registered profiler_controller router")


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
