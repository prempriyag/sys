"""
Batch Details Controller - Displays student transcript details
Matches CI3 Viewfile::batchdetails()
"""
from fastapi import APIRouter, Path, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from database.connection import get_db
from config.constants import TBL_TRANSCRIPTHDRDATA, TBL_INSTITUTION_MAPPING, TBL_TRANSCRIPTHDROCR, TBL_TRANSCRIPTLINEDATA, TBL_TRANSCRIPT_TEST_SCORE_OCR, COLLEGE_PROJECT_ID

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/batchdetails", tags=["batchdetails"])

@router.get("/{batch_id}", response_model=Dict[str, Any])
async def get_batch_details(
    batch_id: str = Path(..., description="Batch ID"),
    db: Session = Depends(get_db)
):
    """
    Get batch details including header data, line data, and test scores
    Matches CI3 Viewfile::batchdetails()
    """
    try:
        if not batch_id:
            raise HTTPException(status_code=400, detail="Batch ID is required")
        
        # Get header data with joins (matches CI3 lines 115-121)
        # Include FILE_PATH from OCR table if available
        header_query = text(f"""
            SELECT h.*, m.INSTITUTION_NAME, m.INSTITUTION_ID, o.EXTERNAL_INSTITUTION_NAME, o.FILE_PATH
            FROM {TBL_TRANSCRIPTHDRDATA} as h
            LEFT JOIN {TBL_INSTITUTION_MAPPING} as m ON h.INSTITUTION_ID = m.INSTITUTION_ID
            LEFT JOIN {TBL_TRANSCRIPTHDROCR} as o ON h.BATCH_ID = o.BATCH_ID
            WHERE h.BATCH_ID = :batch_id
        """)
        
        header_result = db.execute(header_query, {"batch_id": batch_id}).fetchone()
        
        if not header_result:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        header_data = dict(header_result._mapping)
        
        # Generate encrypted transcript URL (handles FTP→share-path conversion)
        file_path = header_data.get("FILE_PATH") or ""
        from helpers.common_helper import build_transcript_url
        header_data["TRANSCRIPT_URL"] = build_transcript_url(
            db, file_path, batch_id, COLLEGE_PROJECT_ID
        )
        
        # Get line data (matches CI3 lines 124-129)
        line_query = text(f"""
            SELECT *
            FROM {TBL_TRANSCRIPTLINEDATA}
            WHERE BATCH_ID = :batch_id
            AND STATUS_FLAG <> 'ERROR'
            ORDER BY START_TERM ASC
        """)
        
        line_results = db.execute(line_query, {"batch_id": batch_id}).fetchall()
        line_data = [dict(row._mapping) for row in line_results]
        
        # Get test score data (matches CI3 lines 133-138)
        test_score_query = text(f"""
            SELECT *
            FROM {TBL_TRANSCRIPT_TEST_SCORE_OCR}
            WHERE BATCH_ID = :batch_id
            AND STATUS_FLAG <> 'ERROR'
            ORDER BY TEST_DATE ASC
        """)
        
        test_score_results = db.execute(test_score_query, {"batch_id": batch_id}).fetchall()
        test_score_data = [dict(row._mapping) for row in test_score_results]
        
        return {
            "status": 1,
            "data": {
                "rec": header_data,
                "linedata": line_data,
                "TSI_DATA": test_score_data
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error fetching batch details: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

