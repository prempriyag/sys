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
from models.transcripts_model import TranscriptsModel
from config.constants import (
    TRANSCRIPTS_COLLEGE,
    COLLEGE_PROJECT_ID,
    TBL_DOWNLOAD,
)
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/transcripts",
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
    Matches CI3 Transcripts::ajaxlist() -> Transcripts_model::gettranscriptsdata()
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

        result = TranscriptsModel.get_transcripts_data(
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

        # Build folder path
        folder = os.path.join(TRANSCRIPTS_COLLEGE, source_type)
        
        # Create folder if it doesn't exist
        os.makedirs(folder, exist_ok=True)

        uploaded_files = []
        uploaded_count = 0

        for file in files:
            if not file.filename:
                continue

            # Validate PDF
            if not file.filename.lower().endswith('.pdf'):
                logger.warning(f"Skipping non-PDF file: {file.filename}")
                continue

            try:
                # Read file content
                contents = await file.read()

                # Generate formatted filename (matches CI3 lines 228-243)
                file_base_name = os.path.splitext(file.filename)[0]
                sanitized_name = sanitize_filename(file.filename)
                ext = os.path.splitext(file.filename)[1]
                date_str = datetime.now().strftime('%Y-%m-%d')
                random_str = generate_random_string(5)
                new_filename = f"{sanitized_name.lower()}_{source_type}_{date_str}_{random_str}{ext}"

                # Save file
                file_path = os.path.join(folder, new_filename)
                with open(file_path, 'wb') as f:
                    f.write(contents)

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

                logger.info(f"File uploaded successfully: {file.filename} -> {new_filename}")

            except Exception as e:
                logger.error(f"Error uploading file {file.filename}: {e}")
                continue

        if uploaded_count > 0:
            return {
                "success": True,
                "message": f"Successfully uploaded {uploaded_count} file(s) for processing",
                "uploaded_files": uploaded_files
            }
        else:
            raise HTTPException(status_code=400, detail="No files were uploaded successfully")

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
    Matches CI3 Transcripts::add() method source type logic
    """
    try:
        # Get source types from folder structure
        base_path = TRANSCRIPTS_COLLEGE
        if not os.path.exists(base_path):
            return {"sources": []}
        
        sources = []
        for item in os.listdir(base_path):
            item_path = os.path.join(base_path, item)
            if os.path.isdir(item_path):
                sources.append(item)
        
        sources.sort()
        return {"sources": sources}
    except Exception as e:
        logger.error(f"Error getting source types: {e}")
        return {"sources": []}

