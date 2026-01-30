"""
Viewfile Controller - Handles secure file viewing with encryption
Matches CI3 Viewfile.php functionality
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import os
import logging
from helpers.encryption_helper import file_decrypt, get_encrypt_file_path
from database.connection import get_db
from config.settings import Settings
from config.constants import TBL_KICKOUT, SHARE_PATH_REPLACE, SHARE_PATH_UBUNTU, IS_UBUNTU

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/school/viewfile", tags=["viewfile"])
settings = Settings()

class EncryptRequest(BaseModel):
    """Request model for encrypting file paths"""
    file_path: str

# File path constants (should match CI3 constants)
# These should be in .env or config
SHAR_PATH = os.getenv("SHAR_PATH", "")
SHARE_PATH_REPLACE = os.getenv("SHARE_PATH_REPLACE", "")
SHARE_PATH_UBUNTU = os.getenv("SHARE_PATH_UBUNTU", "")
IS_UBUNTU = os.getenv("IS_UBUNTU", "false").lower() == "true"
SCHOOL_SHARE_PATH = os.getenv("SCHOOL_SHARE_PATH", "")
UPLOAD_TRANSCRIPT_PATH = os.getenv("UPLOAD_TRANSCRIPT_PATH", "")

@router.post("/encrypt", response_model=Dict[str, Any])
async def encrypt_file_path(
    request: EncryptRequest,
    # Temporarily disable auth for testing
    # db: Session = Depends(get_db)
):
    """
    Encrypt a file path for secure viewing
    """
    try:
        if not request.file_path:
            raise HTTPException(status_code=400, detail="file_path is required")
        
        encrypted_path = get_encrypt_file_path(request.file_path)
        return {
            "status": 1,
            "data": {
                "encrypted_path": encrypted_path
            }
        }
    except Exception as e:
        logger.exception(f"Error encrypting file path: {e}")
        raise HTTPException(status_code=500, detail=f"Error encrypting file path: {str(e)}")

@router.get("/transcript_file")
async def transcript_file(
    pdf: str = Query(..., description="Encrypted file path"),
    # Temporarily disable auth for testing
    # db: Session = Depends(get_db)
):
    """
    Serve transcript files securely using encrypted paths
    Matches CI3 Viewfile::transcript_file()
    """
    try:
        if not pdf:
            raise HTTPException(status_code=400, detail="Missing pdf parameter")
        
        # Decrypt the file path
        path = file_decrypt(pdf)
        print(path)
        # Handle Ubuntu path conversion
        if IS_UBUNTU:
            path = path.replace('\\', '/')
            if SHARE_PATH_REPLACE and SHARE_PATH_UBUNTU:
                path = path.replace(SHARE_PATH_REPLACE, SHARE_PATH_UBUNTU)
        
        # Check if file exists
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get filename for Content-Disposition
        filename = os.path.basename(path)
        
        # Return file as PDF
        return FileResponse(
            path,
            media_type="application/pdf",
            headers={
                "Cache-Control": "public",
                "Content-Disposition": f'inline; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error serving transcript file: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving file: {str(e)}")

@router.get("/errorscreenshot/{batch_id}")
async def error_screenshot(
    batch_id: str,
    db: Session = Depends(get_db)
):
    """
    Display error screenshot for a batch
    Matches CI3 Viewfile::errorscreenshot()
    """
    try:
        from sqlalchemy import text
        
        # Get error screenshot path from database
        query = text(f"""
            SELECT ERROR_SCREENSHOT, PROJECT_ID 
            FROM {TBL_KICKOUT} 
            WHERE BATCH_ID = :batch_id
        """)
        result = db.execute(query, {"batch_id": batch_id}).fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        error_screenshot = dict(result._mapping).get("ERROR_SCREENSHOT")
        
        if not error_screenshot or error_screenshot == "":
            raise HTTPException(status_code=404, detail="Error screenshot not found")
        
        # Handle path conversion for Ubuntu (matches CI3 imagepreview.php lines 28-31)
        error_path = error_screenshot
        if IS_UBUNTU:
            error_path = error_path.replace('\\', '/')
            if SHARE_PATH_REPLACE and SHARE_PATH_UBUNTU:
                error_path = error_path.replace(SHARE_PATH_REPLACE, SHARE_PATH_UBUNTU)
        
        # Check if file exists
        if not os.path.exists(error_path):
            logger.warning(f"Error screenshot file not found at path: {error_path} (original: {error_screenshot})")
            raise HTTPException(status_code=404, detail="Screenshot file not found")
        
        # Determine content type based on file extension
        ext = os.path.splitext(error_path)[1].lower()
        if ext == ".png":
            content_type = "image/png"
        elif ext in [".jpg", ".jpeg"]:
            content_type = "image/jpeg"
        else:
            # Default to jpeg if extension is unknown
            content_type = "image/jpeg"
        
        return FileResponse(
            error_path,
            media_type=content_type,
            headers={"Cache-Control": "public"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error serving error screenshot: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving screenshot: {str(e)}")

@router.get("/showtranscripts")
async def show_transcripts(
    pdf: str = Query(..., description="Base64 encoded file path")
):
    """
    Serve uploaded transcript files
    Matches CI3 Viewfile::showtranscripts()
    """
    try:
        import base64
        
        if not pdf:
            raise HTTPException(status_code=400, detail="Missing pdf parameter")
        
        # Decode base64 path
        decoded_path = base64.b64decode(pdf).decode('utf-8')
        decoded_path = decoded_path.replace(" ", "%20")
        
        # Construct file path
        # CI3 uses: FCPATH . 'uploads/' . decoded_path
        file_path = os.path.join("uploads", decoded_path)
        
        # Check if file exists
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Get filename
        filename = os.path.basename(decoded_path)
        
        return FileResponse(
            file_path,
            media_type="application/pdf",
            headers={
                "Cache-Control": "public",
                "Content-Disposition": f'inline; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error serving transcript: {e}")
        raise HTTPException(status_code=500, detail=f"Error serving file: {str(e)}")

@router.get("/global_search", response_model=Dict[str, Any])
async def global_search(
    query: str = Query(..., description="Search query (minimum 4 characters)"),
    db: Session = Depends(get_db)
):
    """
    Global search for students and batches
    Matches CI3 Viewfile::global_search()
    """
    try:
        query = query.strip()
        if len(query) < 4:
            return {"students": [], "batches": []}
        
        result = {"students": [], "batches": []}
        
        if query.isdigit():
            # Numeric query - search both Student ID and Batch ID
            # Search students
            student_query = text(f"""
                SELECT DISTINCT STUDENT_ID, STUDENT_FULL_NAME, BATCH_ID, PROJECT_ID
                FROM {TBL_KICKOUT}
                WHERE STUDENT_ID LIKE :query
                ORDER BY STUDENT_ID
            """)
            students = db.execute(student_query, {"query": f"%{query}%"}).fetchall()
            result["students"] = [
                {
                    "STUDENT_ID": str(row.STUDENT_ID) if row.STUDENT_ID else "",
                    "STUDENT_FULL_NAME": row.STUDENT_FULL_NAME or "",
                    "BATCH_ID": str(row.BATCH_ID) if row.BATCH_ID else "",
                    "PROJECT_ID": str(row.PROJECT_ID) if row.PROJECT_ID else "2"
                }
                for row in students
            ]
            
            # Search batches
            batch_query = text(f"""
                SELECT DISTINCT BATCH_ID, PROJECT_ID
                FROM {TBL_KICKOUT}
                WHERE BATCH_ID LIKE :query
                ORDER BY BATCH_ID
            """)
            batches = db.execute(batch_query, {"query": f"%{query}%"}).fetchall()
            result["batches"] = [
                {
                    "BATCH_ID": str(row.BATCH_ID) if row.BATCH_ID else "",
                    "PROJECT_ID": str(row.PROJECT_ID) if row.PROJECT_ID else "2"
                }
                for row in batches
            ]
        else:
            # Text query - search only student names
            student_query = text(f"""
                SELECT DISTINCT STUDENT_ID, STUDENT_FULL_NAME, BATCH_ID, PROJECT_ID
                FROM {TBL_KICKOUT}
                WHERE STUDENT_FULL_NAME LIKE :query
                ORDER BY STUDENT_FULL_NAME
            """)
            students = db.execute(student_query, {"query": f"%{query}%"}).fetchall()
            result["students"] = [
                {
                    "STUDENT_ID": str(row.STUDENT_ID) if row.STUDENT_ID else "",
                    "STUDENT_FULL_NAME": row.STUDENT_FULL_NAME or "",
                    "BATCH_ID": str(row.BATCH_ID) if row.BATCH_ID else "",
                    "PROJECT_ID": str(row.PROJECT_ID) if row.PROJECT_ID else "2"
                }
                for row in students
            ]
        
        return result
    except Exception as e:
        logger.exception(f"Error in global_search: {e}")
        raise HTTPException(status_code=500, detail=f"Error performing search: {str(e)}")

