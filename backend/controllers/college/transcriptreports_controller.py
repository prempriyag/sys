"""
Transcript Reports Controller - College Module
FastAPI version of CI3 Transcriptreports controller
Uses TranscriptReportsModel for all query logic (common code like CI3)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from models import User
from models.transcript_reports_model import TranscriptReportsModel

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/transcriptreports",
    tags=["transcriptreports"],
)


# ---------------------- #
# DataTables Request
# ---------------------- #
class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list
    Search_Field: Optional[str] = None
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    STUDENT_ID: Optional[str] = None
    BATCH_ID: Optional[str] = None


# ---------------------- #
# AJAX LIST (Common endpoint for all transcript report types)
# ---------------------- #
@router.get("/test")
async def test_query(
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_digiscript_reports", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Test endpoint to verify database connection and check for data
    """
    from sqlalchemy import text
    from config.constants import TBL_KICKOUT, TBL_TRANSCRIPTHDRDATA, TBL_DOWNLOAD, COLLEGE_PROJECT_ID
    
    try:
        # Test 1: Check if table exists and has any data
        test1 = db.execute(text(f"SELECT COUNT(*) as cnt FROM {TBL_KICKOUT} WITH(NOLOCK)")).fetchone()
        
        # Test 2: Check records with PROJECT_ID
        test2 = db.execute(text(f"SELECT COUNT(*) as cnt FROM {TBL_KICKOUT} WITH(NOLOCK) WHERE PROJECT_ID = {COLLEGE_PROJECT_ID}")).fetchone()
        
        # Test 3: Check if joins work
        test3_sql = f"""
            SELECT COUNT(*) as cnt
            FROM {TBL_KICKOUT} k WITH(NOLOCK)
            INNER JOIN {TBL_TRANSCRIPTHDRDATA} h WITH(NOLOCK) ON h.BATCH_ID=k.BATCH_ID
            INNER JOIN {TBL_DOWNLOAD} d WITH(NOLOCK) ON d.BATCH_ID=k.BATCH_ID
            WHERE k.PROJECT_ID = {COLLEGE_PROJECT_ID}
        """
        test3 = db.execute(text(test3_sql)).fetchone()
        
        # Test 4: Get a sample record
        sample_sql = f"""
            SELECT TOP 1 k.BATCH_ID, k.PROJECT_ID, k.TRANSCRIPT_STATUS_FLAG
            FROM {TBL_KICKOUT} k WITH(NOLOCK)
            WHERE k.PROJECT_ID = {COLLEGE_PROJECT_ID}
        """
        sample = db.execute(text(sample_sql)).fetchone()
        
        return {
            "test1_total_records": test1.cnt if test1 else 0,
            "test2_records_with_project_id": test2.cnt if test2 else 0,
            "test3_records_with_joins": test3.cnt if test3 else 0,
            "sample_record": dict(sample._mapping) if sample else None,
            "project_id": COLLEGE_PROJECT_ID,
            "table_names": {
                "kickout": TBL_KICKOUT,
                "hdrdata": TBL_TRANSCRIPTHDRDATA,
                "download": TBL_DOWNLOAD,
            }
        }
    except Exception as e:
        logger.exception("Test query error")
        return {"error": str(e)}


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: DataTableRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("college_digiscript_reports", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get transcript reports data for DataTables
    Common endpoint for all types: Failed, Processed, Rerun, Articulation-Kickouts, equivalenthours
    Matches CI3 Transcriptreports::ajaxlist() -> Transcripts_model::getreportsdata()
    """
    try:
        # Convert Pydantic model to dict for model
        request_data = request.model_dump()

        # Check if user has update permission (for rendering action dropdowns)
        # Temporarily disabled for testing
        has_update_permission = False
        # try:
        #     from helpers.permission_helper import check_permission
        #     has_update_permission = check_permission(
        #         current_user, "college_digiscript_reports", "UPDATE"
        #     )
        # except:
        #     pass

        # Use model to get data (common code like CI3)
        result = TranscriptReportsModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

        return result

    except Exception as e:
        logger.exception("Transcript ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ---------------------- #
# Update Student ID
# ---------------------- #
class UpdateStudentIdRequest(BaseModel):
    batchId: str
    studentid: str


@router.post("/updatestudentid")
async def updatestudentid(
    request: UpdateStudentIdRequest,
    current_user: User = Depends(require_permission("college_digiscript_reports", "UPDATE")),
    db: Session = Depends(get_db),
):
    """
    Update Student ID for a batch
    Matches CI3 Transcriptreports::updatestudentid()
    """
    from sqlalchemy import text
    from datetime import datetime
    from config.constants import TBL_KICKOUT, TBL_TRANSCRIPTHDRDATA, TBL_TRANSCRIPTLINEDATA, TBL_ARTICULATIONINPUT
    
    try:
        batch_id = request.batchId
        student_id = request.studentid
        username = current_user.name
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        
        # Get existing USER_COMMENTS
        get_comment_sql = text(f"""
            SELECT BATCH_ID, USER_COMMENTS
            FROM {TBL_KICKOUT}
            WHERE BATCH_ID = :batch_id
        """)
        row_data = db.execute(get_comment_sql, {"batch_id": batch_id}).fetchone()
        
        # Build comment
        comment = f'Student ID :{student_id}'
        if row_data and row_data.USER_COMMENTS:
            user_comment = f"{row_data.USER_COMMENTS}, {comment}-{username}-{current_time}"
        elif comment:
            user_comment = f"{comment}-{username}-{current_time}"
        else:
            user_comment = f"{username}-{current_time}"
        
        # Update TBL_KICKOUT
        update_kickout_sql = text(f"""
            UPDATE {TBL_KICKOUT}
            SET STUDENT_ID = :student_id,
                USER_COMMENTS = :user_comment,
                UPDATED_BY = LOWER(:username),
                LAST_UPDATED_DATETIME = :current_time
            WHERE BATCH_ID = :batch_id
        """)
        db.execute(update_kickout_sql, {
            "student_id": student_id,
            "user_comment": user_comment,
            "username": username,
            "current_time": current_time,
            "batch_id": batch_id
        })
        
        # Update TBL_TRANSCRIPTLINEDATA
        update_line_sql = text(f"""
            UPDATE {TBL_TRANSCRIPTLINEDATA}
            SET STUDENT_ID = :student_id
            WHERE BATCH_ID = :batch_id
        """)
        db.execute(update_line_sql, {
            "student_id": student_id,
            "batch_id": batch_id
        })
        
        # Update TBL_ARTICULATIONINPUT
        update_articulation_sql = text(f"""
            UPDATE {TBL_ARTICULATIONINPUT}
            SET STUDENT_ID = :student_id
            WHERE BATCH_ID = :batch_id
        """)
        db.execute(update_articulation_sql, {
            "student_id": student_id,
            "batch_id": batch_id
        })
        
        # Update TBL_TRANSCRIPTHDRDATA
        update_hdr_sql = text(f"""
            UPDATE {TBL_TRANSCRIPTHDRDATA}
            SET STUDENT_ID = :student_id,
                UPDATED_BY = UPPER(:username),
                LAST_UPDATED_DATETIME = :current_time
            WHERE BATCH_ID = :batch_id
        """)
        db.execute(update_hdr_sql, {
            "student_id": student_id,
            "username": username,
            "current_time": current_time,
            "batch_id": batch_id
        })
        
        db.commit()
        return {"message": "Success", "success": True}
        
    except Exception as e:
        db.rollback()
        logger.exception("Update student ID error")
        raise HTTPException(status_code=500, detail=f"Error updating student ID: {str(e)}")


# ---------------------- #
# Update Slate ID
# ---------------------- #
class UpdateSlateIdRequest(BaseModel):
    batchId: str
    slateid: str


@router.post("/updateslateid")
async def updateslateid(
    request: UpdateSlateIdRequest,
    current_user: User = Depends(require_permission("college_digiscript_reports", "UPDATE")),
    db: Session = Depends(get_db),
):
    """
    Update Slate ID for a batch
    Matches CI3 Transcriptreports::updateslateid()
    """
    from sqlalchemy import text
    from datetime import datetime
    from config.constants import TBL_KICKOUT, TBL_TRANSCRIPTHDRDATA
    
    try:
        batch_id = request.batchId
        slate_id = request.slateid
        username = current_user.name
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        
        # Get existing USER_COMMENTS
        get_comment_sql = text(f"""
            SELECT BATCH_ID, USER_COMMENTS
            FROM {TBL_KICKOUT}
            WHERE BATCH_ID = :batch_id
        """)
        row_data = db.execute(get_comment_sql, {"batch_id": batch_id}).fetchone()
        
        # Build comment
        comment = f'Slate ID :{slate_id}'
        if row_data and row_data.USER_COMMENTS:
            user_comment = f"{row_data.USER_COMMENTS}, {comment}-{username}-{current_time}"
        elif comment:
            user_comment = f"{comment}-{username}-{current_time}"
        else:
            user_comment = f"{username}-{current_time}"
        
        # Update TBL_KICKOUT
        update_kickout_sql = text(f"""
            UPDATE {TBL_KICKOUT}
            SET SLATE_REF_NUMBER = :slate_id,
                USER_COMMENTS = :user_comment,
                UPDATED_BY = LOWER(:username),
                LAST_UPDATED_DATETIME = :current_time
            WHERE BATCH_ID = :batch_id
        """)
        db.execute(update_kickout_sql, {
            "slate_id": slate_id,
            "user_comment": user_comment,
            "username": username,
            "current_time": current_time,
            "batch_id": batch_id
        })
        
        # Update TBL_TRANSCRIPTHDRDATA
        update_hdr_sql = text(f"""
            UPDATE {TBL_TRANSCRIPTHDRDATA}
            SET SLATE_REF_NUMBER = :slate_id,
                UPDATED_BY = UPPER(:username),
                LAST_UPDATED_DATETIME = :current_time
            WHERE BATCH_ID = :batch_id
        """)
        db.execute(update_hdr_sql, {
            "slate_id": slate_id,
            "username": username,
            "current_time": current_time,
            "batch_id": batch_id
        })
        
        db.commit()
        return {"message": "Success", "success": True}
        
    except Exception as e:
        db.rollback()
        logger.exception("Update slate ID error")
        raise HTTPException(status_code=500, detail=f"Error updating slate ID: {str(e)}")


# ---------------------- #
# Check Institution ID
# ---------------------- #
class CheckInstIdRequest(BaseModel):
    instid: str
    batchId: str


@router.post("/chckinstid")
async def chckinstid(
    request: CheckInstIdRequest,
    db: Session = Depends(get_db),
):
    """
    Check if Institution ID exists and matches external institution name
    Matches CI3 Transcriptreports::chckinstid()
    Returns: 1 = valid, 2 = not found, 3 = name mismatch
    """
    from sqlalchemy import text
    from config.constants import TBL_INSTITUTION_MAPPING, TBL_TRANSCRIPTHDROCR
    
    try:
        inst_id = request.instid.strip()
        batch_id = request.batchId
        
        # Check if institution exists
        check_inst_sql = text(f"""
            SELECT INSTITUTION_ID, INSTITUTION_NAME, EXTERNAL_INSTITUTION_NAME
            FROM {TBL_INSTITUTION_MAPPING}
            WHERE INSTITUTION_ID = :inst_id
        """)
        inst_result = db.execute(check_inst_sql, {"inst_id": inst_id}).fetchone()
        
        # Get external institution name from transcript header OCR
        get_hdr_sql = text(f"""
            SELECT BATCH_ID, EXTERNAL_INSTITUTION_NAME
            FROM {TBL_TRANSCRIPTHDROCR}
            WHERE BATCH_ID = :batch_id
        """)
        hdr_data = db.execute(get_hdr_sql, {"batch_id": batch_id}).fetchone()
        
        if not inst_result:
            # Institution ID does not exist
            return {"result": 2, "message": "Institution ID does not exist in the Institution Mapping."}
        
        if hdr_data and inst_result:
            # Check if names match
            external_name = hdr_data.EXTERNAL_INSTITUTION_NAME.strip().upper() if hdr_data.EXTERNAL_INSTITUTION_NAME else ""
            inst_external_name = inst_result.EXTERNAL_INSTITUTION_NAME.strip().upper() if inst_result.EXTERNAL_INSTITUTION_NAME else ""
            
            if external_name == inst_external_name:
                return {"result": 1, "message": "Valid"}
            else:
                return {"result": 3, "message": "Transcript Institution Name and External Institution Name must be same."}
        
        return {"result": 1, "message": "Valid"}
        
    except Exception as e:
        logger.exception("Check institution ID error")
        raise HTTPException(status_code=500, detail=f"Error checking institution ID: {str(e)}")


# ---------------------- #
# Update Check Status (Bulk Update)
# ---------------------- #
class UpdateChkStatusRequest(BaseModel):
    comment: str
    batchId: str
    reprocessTranscript: Optional[str] = None
    processTranscript_articulated: Optional[str] = None
    articulationProcess: Optional[str] = None
    osuid: Optional[str] = None
    slateid: Optional[str] = None
    scenario: Optional[str] = None
    instid: Optional[str] = None


@router.post("/updatechkstatus")
async def updatechkstatus(
    request: UpdateChkStatusRequest,
    current_user: User = Depends(require_permission("college_digiscript_reports", "UPDATE")),
    db: Session = Depends(get_db),
):
    """
    Update transcript status (bulk update for action items)
    Matches CI3 Transcriptreports::updatechkstatus()
    """
    from sqlalchemy import text
    from datetime import datetime
    from config.constants import TBL_KICKOUT
    
    try:
        batch_id = request.batchId
        comment = request.comment
        reprocess_transcript = request.reprocessTranscript or "0"
        articulation_process = request.articulationProcess or "0"
        process_transcript_articulated = request.processTranscript_articulated or ""
        osuid = request.osuid or ""
        slateid = request.slateid or ""
        scenario = request.scenario or ""
        instid = request.instid or ""
        
        # Debug logging
        logger.info(f"[updatechkstatus] Received update request for batch {batch_id}")
        logger.info(f"[updatechkstatus] Request data: batchId={batch_id}, comment={comment}, "
                   f"reprocessTranscript={reprocess_transcript}, articulationProcess={articulation_process}, "
                   f"osuid={osuid}, slateid={slateid}, instid={instid}, scenario={scenario}")
        
        username = current_user.name
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S.000')
        
        # Get existing USER_COMMENTS and check if we're only updating fields (not actions)
        get_comment_sql = text(f"""
            SELECT BATCH_ID, USER_COMMENTS
            FROM {TBL_KICKOUT}
            WHERE BATCH_ID = :batch_id
        """)
        row_data = db.execute(get_comment_sql, {"batch_id": batch_id}).fetchone()
        
        # Check if this is just a field update (instid/osuid/slateid) without actions
        is_field_only_update = (
            (not reprocess_transcript or reprocess_transcript == "0") and
            (not articulation_process or articulation_process == "0") and
            (instid or osuid or slateid) and
            not comment  # No comment provided
        )
        
        # Build USER_COMMENTS
        # Only update USER_COMMENTS if there's a comment or an action, not for field-only updates
        if is_field_only_update:
            # For field-only updates, keep existing USER_COMMENTS unchanged
            user_comment = row_data.USER_COMMENTS if row_data and row_data.USER_COMMENTS else None
        elif row_data and row_data.USER_COMMENTS:
            user_comment = f"{row_data.USER_COMMENTS}; {comment}-{username}-{current_time}" if comment else f"{row_data.USER_COMMENTS}; {username}-{current_time}"
        elif comment:
            user_comment = f"{comment}-{username}-{current_time}"
        else:
            user_comment = f"{username}-{current_time}"
        
        # Build update data
        update_fields = {
            "UPDATED_BY": username.lower(),
            "LAST_UPDATED_DATETIME": current_time
        }
        
        # Only update USER_COMMENTS if it changed (not None for field-only updates)
        if user_comment is not None:
            update_fields["USER_COMMENTS"] = user_comment
        
        if osuid:
            update_fields["STUDENT_ID"] = osuid
        if slateid:
            update_fields["SLATE_REF_NUMBER"] = slateid
        if instid:
            update_fields["INSTITUTION_ID"] = instid
        
        # Handle articulation process
        if articulation_process == 'Processed' and articulation_process != '0':
            update_fields["ERROR_REASON"] = None
            update_fields["ERROR_SCREENSHOT"] = None
        
        # Handle reprocess transcript
        if reprocess_transcript == 'Processed' and reprocess_transcript != '0':
            if process_transcript_articulated == 'Articulated':
                update_fields["TRANSCRIPT_STATUS_FLAG"] = reprocess_transcript
                update_fields["ARTICULATION_STATUS_FLAG"] = reprocess_transcript
            else:
                update_fields["TRANSCRIPT_STATUS_FLAG"] = reprocess_transcript
            
            if scenario and scenario != '0':
                update_fields["SCENARIO"] = scenario
                
                if scenario == 'Applicant':
                    update_fields["STATUS_SLATE"] = 'Processed'
                    update_fields["STATUS_SLATE_UPLOAD"] = 'Processed'
                    update_fields["STATUS_SOAPCOL"] = 'Processed'
                    update_fields["STATUS_BDMS"] = 'Processed'
                    update_fields["STATUS_SHATAEQ"] = 'Processed'
                elif scenario == 'Continuing Student':
                    update_fields["STATUS_SLATE"] = ''
                    update_fields["STATUS_SLATE_UPLOAD"] = ''
                    update_fields["STATUS_BDMS"] = 'Processed'
                    update_fields["STATUS_SOAPCOL"] = 'Processed'
                    update_fields["STATUS_SHATAEQ"] = 'Processed'
        else:
            # Handle articulation process status
            if articulation_process == 'Noaction' and articulation_process != '0':
                update_fields["ARTICULATION_STATUS_FLAG"] = 'No Action Needed'
            elif articulation_process != '0':
                update_fields["ARTICULATION_STATUS_FLAG"] = articulation_process
            
            # Handle reprocess transcript status
            if reprocess_transcript == 'Noaction' and reprocess_transcript != '0':
                update_fields["TRANSCRIPT_STATUS_FLAG"] = 'No Action Needed'
                update_fields["ARTICULATION_STATUS_FLAG"] = 'No Action Needed'
            elif reprocess_transcript != '0':
                update_fields["TRANSCRIPT_STATUS_FLAG"] = reprocess_transcript
        
        # Build SQL update statement
        set_clauses = []
        params = {"batch_id": batch_id}
        for key, value in update_fields.items():
            if value is None:
                set_clauses.append(f"{key} = NULL")
            else:
                param_name = key.lower().replace('_', '_')
                set_clauses.append(f"{key} = :{param_name}")
                params[param_name] = value
        
        if not set_clauses:
            logger.warning(f"[updatechkstatus] No fields to update for batch {batch_id}")
            return {"message": "No fields to update", "success": False}
        
        update_sql = text(f"""
            UPDATE {TBL_KICKOUT}
            SET {', '.join(set_clauses)}
            WHERE BATCH_ID = :batch_id
        """)
        
        logger.info(f"[updatechkstatus] Executing SQL update for batch {batch_id}")
        logger.info(f"[updatechkstatus] Update fields: {list(update_fields.keys())}")
        logger.debug(f"[updatechkstatus] SQL: {update_sql}")
        logger.debug(f"[updatechkstatus] Params: {params}")
        
        result = db.execute(update_sql, params)
        db.commit()
        
        logger.info(f"[updatechkstatus] Update successful for batch {batch_id}. Rows affected: {result.rowcount}")
        
        return {"message": "Success", "success": True}
        
    except Exception as e:
        db.rollback()
        logger.exception("Update check status error")
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")

