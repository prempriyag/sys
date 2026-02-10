"""
Stored Procedure Controller - College Module
FastAPI version of CI3 Storedprocedure controller
Handles Reset Batch ID stored procedure execution
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from sqlalchemy import text
import logging

from database.connection import get_db
from helpers.permission_dependency import require_permission
from helpers.security_helper import get_username_from_token
from models import User
from config.constants import TBL_TRANSCRIPTHDRDATA

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/storedprocedure",
    tags=["storedprocedure"],
)


class BatchIdRequest(BaseModel):
    BATCH_ID: str


class GetNameResponse(BaseModel):
    error: int
    msg: str
    data: dict = None
    refresh: bool = False


@router.post("/getname", response_model=GetNameResponse)
async def getname(
    request: BatchIdRequest,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("stored_procedure", "VIEW")
    # ),
    db: Session = Depends(get_db),
):
    """
    Get student name by Batch ID
    Matches CI3 Storedprocedure::getname() method (lines 25-51)
    """
    try:
        batch_id = request.BATCH_ID.strip()
        
        if not batch_id:
            return GetNameResponse(
                error=1,
                msg="Batch ID is Required",
                refresh=True
            )
        
        # Query database for Batch ID and Student Name
        query = text(f"""
            SELECT TOP 1 BATCH_ID, STUDENT_FULL_NAME
            FROM {TBL_TRANSCRIPTHDRDATA}
            WHERE BATCH_ID = :batch_id
        """)
        
        result = db.execute(query, {"batch_id": batch_id}).fetchone()
        
        if not result:
            return GetNameResponse(
                error=1,
                msg="Invalid Batch ID",
                refresh=True
            )
        
        return GetNameResponse(
            error=0,
            msg="Valid",
            data={
                "BATCH_ID": result.BATCH_ID,
                "STUDENT_FULL_NAME": result.STUDENT_FULL_NAME
            }
        )
        
    except Exception as e:
        logger.exception("Stored procedure getname error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


class RunResponse(BaseModel):
    error: int
    msg: str


@router.post("/run", response_model=RunResponse)
async def run(
    request: BatchIdRequest,
    http_request: Request,
    # Temporarily disabled authentication for testing
    # current_user: User = Depends(
    #     require_permission("stored_procedure", "ADD")
    # ),
    db: Session = Depends(get_db),
):
    """
    Execute stored procedure TRANSCRIPT_REPROCESS_AS_NEW
    Matches CI3 Storedprocedure::run() method (lines 54-86)
    """
    try:
        batch_id = request.BATCH_ID.strip()
        
        if not batch_id:
            return RunResponse(
                error=1,
                msg="Batch ID is missing."
            )
        
        # Get username from JWT token
        username = get_username_from_token(http_request)
        
        # Execute stored procedure
        # Note: SQL Server stored procedure execution with parameters
        query = text("""
            EXEC TRANSCRIPT_REPROCESS_AS_NEW 
            @BATCH_ID = :batch_id, 
            @USERNAME = :username
        """)
        
        logger.info(f"Executing stored procedure TRANSCRIPT_REPROCESS_AS_NEW with BATCH_ID={batch_id}, USERNAME={username}")
        
        result = db.execute(query, {
            "batch_id": batch_id,
            "username": username
        })
        
        # Fetch the result
        # The stored procedure returns a result set with a 'Result' column
        row = result.fetchone()
        
        if row and hasattr(row, 'Result') and row.Result == '1':
            db.commit()
            return RunResponse(
                error=0,
                msg="Stored Procedure executed successfully."
            )
        else:
            db.rollback()
            return RunResponse(
                error=1,
                msg="Invalid Batch ID."
            )
            
    except Exception as e:
        logger.exception("Stored procedure run error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



