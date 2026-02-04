"""
Transcripts Controller - College Module
FastAPI version of CI3 Transcripts controller
Handles transcript upload and uploaded transcripts list
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
import logging
import os
from datetime import datetime
import random
import string

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.school_transcripts_model import SchoolTranscriptsModel
from config.constants import (
    TRANSCRIPTS_COLLEGE,
    COLLEGE_PROJECT_ID,
    TBL_DOWNLOAD,
    resolve_transcript_path,
    IS_UBUNTU,
)
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/school/transcripts",
    tags=["transcripts"],
)


class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: DataTableRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_downloaded_transcripts", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get Uploaded Transcripts data for DataTables
    Matches CI3 Transcripts::ajaxlist() -> SchoolTranscripts_model::gettranscriptsdata()
    """
    try:
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
            "fieldType": request.fieldType,
            "fieldName": request.fieldName,
            "fromDate": request.fromDate,
            "toDate": request.toDate,
        }

        has_update_permission = False

        result = SchoolTranscriptsModel.get_transcripts_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        return result

    except Exception as e:
        logger.exception("Transcripts ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def generate_random_string(length: int = 5) -> str:
    """Generate random string of digits"""
    return ''.join(random.choices(string.digits, k=length))


def sanitize_filename(filename: str) -> str:
    """Sanitize filename by replacing special characters and dots with dashes"""
    # Remove extension
    base_name = os.path.splitext(filename)[0]
    # Replace special characters and dots with dashes
    sanitized = ''.join(c if c.isalnum() or c in ('-', '_') else '-' for c in base_name)
    # Remove multiple consecutive dashes
    while '--' in sanitized:
        sanitized = sanitized.replace('--', '-')
    return sanitized.strip('-')


@router.post("/upload")
async def upload_transcripts(
    source_type: str = Form(...),
    files: List[UploadFile] = File(...),
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_upload_transcripts", "ADD")
    # ),
    db: Session = Depends(get_db),
):
    """
    Upload transcript files
    Matches CI3 Transcripts::insert() method (lines 188-297)
    """
    try:
        if not source_type:
            raise HTTPException(status_code=400, detail="Please select Source Type")
        
        if not files or len(files) == 0:
            raise HTTPException(status_code=400, detail="Please upload Transcript file")
        
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="Please upload a maximum of 10 files")

        # Build folder path - resolve for Ubuntu (matches CI3 Transcripts::insert)
        folder = os.path.join(TRANSCRIPTS_COLLEGE, source_type)
        folder = resolve_transcript_path(folder)
        
        # Log path details for debugging
        logger.info(f"Upload folder path: {folder}")
        logger.info(f"IS_UBUNTU: {IS_UBUNTU}, TRANSCRIPTS_COLLEGE: {TRANSCRIPTS_COLLEGE}")
        
        # Create folder if it doesn't exist
        try:
            os.makedirs(folder, exist_ok=True)
            logger.info(f"Folder created/verified: {folder}")
        except Exception as mkdir_err:
            error_msg = f"Failed to create upload folder: {folder}. Error: {str(mkdir_err)}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Verify folder exists and is writable
        if not os.path.exists(folder):
            error_msg = f"Upload folder does not exist after creation attempt: {folder}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)
        
        if not os.access(folder, os.W_OK):
            error_msg = f"Upload folder is not writable: {folder}"
            logger.error(error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        uploaded_files = []
        failed_files = []
        uploaded_count = 0

        for file in files:
            if not file.filename:
                continue

            # Validate PDF
            if not file.filename.lower().endswith('.pdf'):
                logger.warning(f"Skipping non-PDF file: {file.filename}")
                failed_files.append({"filename": file.filename, "error": "Not a PDF file"})
                continue

            try:
                # Read file content
                contents = await file.read()
                
                if not contents or len(contents) == 0:
                    error_msg = f"File {file.filename} is empty"
                    logger.warning(error_msg)
                    failed_files.append({"filename": file.filename, "error": "File is empty"})
                    continue

                # Generate formatted filename (matches CI3 lines 228-243)
                file_base_name = os.path.splitext(file.filename)[0]
                sanitized_name = sanitize_filename(file.filename)
                ext = os.path.splitext(file.filename)[1]
                date_str = datetime.now().strftime('%Y-%m-%d')
                random_str = generate_random_string(5)
                new_filename = f"{sanitized_name.lower()}_{source_type}_{date_str}_{random_str}{ext}"

                # Save file - match CI3: $folder . '/' . $newFileName
                # On Ubuntu use explicit forward slash, on Windows use os.path.join
                if IS_UBUNTU:
                    file_path = f"{folder}/{new_filename}"
                else:
                    file_path = os.path.join(folder, new_filename)
                
                logger.info(f"Attempting to save file to: {file_path}")
                
                with open(file_path, 'wb') as f:
                    bytes_written = f.write(contents)
                
                # Verify file was written
                if not os.path.exists(file_path):
                    error_msg = f"File was not created at: {file_path}"
                    logger.error(error_msg)
                    failed_files.append({"filename": file.filename, "error": error_msg})
                    continue
                
                logger.info(f"File saved successfully: {file_path} ({bytes_written} bytes)")

                # Insert into database (matches CI3 lines 252-267)
                from sqlalchemy import text
                insert_query = text(f"""
                    INSERT INTO {TBL_DOWNLOAD} 
                    (UPLOADED_DATETIME, BATCH_ID, PROJECT_ID, SOURCE_TYPE, FILENAME, FORMATTED_FILENAME, FILEPATH, STATUS, ARTICULATION_STATUS_FLAG, UPLOADED_BY)
                    VALUES 
                    (:uploaded_datetime, '', :project_id, :source_type, :filename, :formatted_filename, :filepath, 'New', 'New', :uploaded_by)
                """)
                
                db.execute(insert_query, {
                    "uploaded_datetime": datetime.now().strftime('%Y-%m-%d %H:%M:%S.000'),
                    "project_id": COLLEGE_PROJECT_ID,
                    "source_type": source_type,
                    "filename": file.filename,
                    "formatted_filename": new_filename,
                    "filepath": TRANSCRIPTS_COLLEGE + f"\\{source_type}\\",
                    "uploaded_by": "System"  # TODO: Get from current_user when auth is enabled
                })
                db.commit()

                uploaded_files.append(file.filename)
                uploaded_count += 1

                logger.info(f"File uploaded and recorded: {file.filename} -> {new_filename}")

            except PermissionError as pe:
                error_msg = f"Permission denied writing file: {str(pe)}"
                logger.error(f"Permission error for {file.filename}: {pe}")
                failed_files.append({"filename": file.filename, "error": error_msg})
                continue
            except IOError as ioe:
                error_msg = f"IO error writing file: {str(ioe)}"
                logger.error(f"IO error for {file.filename}: {ioe}")
                failed_files.append({"filename": file.filename, "error": error_msg})
                continue
            except Exception as e:
                error_msg = f"Error: {str(e)}"
                logger.error(f"Error uploading file {file.filename}: {e}")
                failed_files.append({"filename": file.filename, "error": error_msg})
                continue

        if uploaded_count > 0:
            response = {
                "success": True,
                "message": f"Successfully uploaded {uploaded_count} file(s) for processing",
                "uploaded_files": uploaded_files
            }
            if failed_files:
                response["failed_files"] = failed_files
                response["message"] += f". {len(failed_files)} file(s) failed."
            return response
        else:
            # No files uploaded - return detailed error info
            error_detail = f"No files were uploaded successfully. Folder: {folder}"
            if failed_files:
                error_detail += f". Errors: {failed_files}"
            raise HTTPException(status_code=400, detail=error_detail)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcript upload error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")


@router.get("/sources")
async def get_source_types(
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_upload_transcripts", "VIEW")
    # ),
):
    """
    Get available source types from folder structure
    For local dev when network share is unreachable, set TRANSCRIPTS_COLLEGE_PATH in .env
    """
    try:
        override = getattr(settings, "TRANSCRIPTS_COLLEGE_PATH", None)
        base_path = override.strip() if override and str(override).strip() else TRANSCRIPTS_COLLEGE
        base_path = os.path.normpath(base_path.rstrip("/\\"))
        base_path = resolve_transcript_path(base_path)

        if not os.path.exists(base_path):
            return {"sources": [], "path": base_path, "error": "Path does not exist or is not accessible"}
        
        sources = []
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            if os.path.isdir(item_path):
                sources.append(item)
        
        sources.sort()
        return {"sources": sources, "path": base_path}
    except Exception as e:
        logger.error(f"Error getting source types: {e}")
        return {"sources": [], "path": getattr(settings, "TRANSCRIPTS_COLLEGE_PATH", None) or TRANSCRIPTS_COLLEGE, "error": str(e)}



