"""
OCR Verify - Verifier controller.
CI routes: verifiers, assignbatches, batchassignajaxlist, saveassignbatchdata, deleteAssgnBatch,
           tobeassignbatches, ajaxtobeassignbatchelist
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Any
from pydantic import BaseModel
from datetime import datetime
import logging

from database.connection import get_db
from config.constants import (
    TBL_BATCH_ASSIGN_STG,
    TBL_ADMIN,
    TBL_DOWNLOAD,
    TBL_TRANSCRIPTHDROCR,
    TBL_TRANSCRIPT_LINE_OCR_LEFT,
    TBL_TRANSCRIPT_LINE_OCR_RIGHT,
    TBL_TRANSCRIPT_LINE_OCR_MIDDLE,
    COLLEGE_PROJECT_ID,
    SCHOOL_PROJECT_ID,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ocrverify", tags=["ocr-verifier"])


class DataTableRequest(BaseModel):
    draw: int = 1
    start: int = 0
    length: int = 10
    search: dict = {}
    order: list = []
    columns: list = []
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None
    verifierid: Optional[str] = None
    id: Optional[str] = None


class AssignBatchRequest(BaseModel):
    user_name: str
    from_batch_id: int
    to_batch_id: int
    verification_source: str = "PORTAL"
    INSTITUTION_TYPE: str = "college"
    SOURCE_TYPE: str = ""


class DeleteBatchRequest(BaseModel):
    id: int


# GET /api/ocrverify/verifiers - Verifiers list page data / verifiers list
@router.get("/verifiers")
async def verifiers(db: Session = Depends(get_db)):
    """List verifiers. CI: Users/index/verifiers.
    
    Note: The actual DataTable data comes from /api/users/ajaxlist?type=verifiers.
    This endpoint returns metadata needed by the page.
    """
    from models.college_verifier_model import CollegeVerifierModel
    try:
        verifier_list = CollegeVerifierModel.get_verifiers_list(db)
        return {
            "message": "Verifiers list",
            "data": verifier_list,
            "type": "verifiers",
        }
    except Exception:
        return {"message": "Verifiers list", "data": [], "type": "verifiers"}


# GET /api/ocrverify/assignbatches - Assign batches page metadata (verifiers + source types)
@router.get("/assignbatches")
async def assignbatches(db: Session = Depends(get_db)):
    """Assign batches page. CI: ocrverify/Verifier/assignbatches.
    Returns verifiers list and distinct source types for the form dropdowns.
    """
    try:
        # Get verifiers list
        verifiers_q = text(f"""
            SELECT u.id, u.name, u.email
            FROM {TBL_ADMIN} AS u
            INNER JOIN PORTAL_ROLES AS r ON u.role_id = r.ID
            WHERE u.status = 1 AND r.ROLE_KEY = 'verifiers'
            ORDER BY u.name
        """)
        verifier_rows = db.execute(verifiers_q).fetchall()
        verifiers_list = [
            {"id": row._mapping["id"], "name": row._mapping["name"], "email": row._mapping.get("email", "")}
            for row in verifier_rows
        ]

        # Get distinct source types
        source_q = text(f"SELECT DISTINCT SOURCE_TYPE FROM {TBL_DOWNLOAD} WHERE SOURCE_TYPE IS NOT NULL ORDER BY SOURCE_TYPE")
        source_rows = db.execute(source_q).fetchall()
        source_types = [row[0] for row in source_rows if row[0]]

        return {
            "message": "Assign batches",
            "verifiers": verifiers_list,
            "source_types": source_types,
        }
    except Exception as e:
        logger.error(f"assignbatches page data error: {e}")
        return {"message": "Assign batches", "verifiers": [], "source_types": []}


# POST /api/ocrverify/assignbatches/ajaxlist - Batch assign DataTables list
@router.post("/assignbatches/ajaxlist")
async def batchassignajaxlist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """Batch assign list. CI: batchassignajaxlist -> ocrverify/Verifier/batchassignajaxlist."""
    try:
        draw = request.draw
        start = request.start
        length = request.length if request.length > 0 else 10
        search_value = (request.search.get("value") or "").strip()
        verifierid = (request.verifierid or request.id or "").strip()

        # Build WHERE clause
        where_parts = []
        params: dict = {}

        if verifierid:
            where_parts.append("ba.USER_ID = :verifierid")
            params["verifierid"] = verifierid

        if search_value:
            where_parts.append(
                "(LOWER(CAST(ba.FROM_BATCH_ID AS VARCHAR)) LIKE :search "
                "OR LOWER(CAST(ba.TO_BATCH_ID AS VARCHAR)) LIKE :search "
                "OR LOWER(ba.VERIFICATION_SOURCE) LIKE :search "
                "OR LOWER(CAST(ba.INSTITUTION_TYPE AS VARCHAR)) LIKE :search "
                "OR LOWER(ba.SOURCE_TYPE) LIKE :search)"
            )
            params["search"] = f"%{search_value.lower()}%"

        where_sql = " AND ".join(where_parts) if where_parts else "1=1"

        # Total count
        count_q = text(f"SELECT COUNT(*) FROM {TBL_BATCH_ASSIGN_STG} AS ba WHERE {where_sql}")
        total_result = db.execute(count_q, params).fetchone()
        total_records = total_result[0] if total_result else 0

        # Data query
        data_q = text(f"""
            SELECT ba.id, ba.FROM_BATCH_ID, ba.TO_BATCH_ID, ba.VERIFICATION_SOURCE,
                   ba.INSTITUTION_TYPE, ba.SOURCE_TYPE, ba.CREATED_TIME,
                   a.name as username
            FROM {TBL_BATCH_ASSIGN_STG} AS ba
            INNER JOIN {TBL_ADMIN} AS a ON ba.USER_ID = a.id
            WHERE {where_sql}
            ORDER BY ba.id DESC
            OFFSET :start ROWS FETCH NEXT :length ROWS ONLY
        """)
        params["start"] = start
        params["length"] = length
        rows = db.execute(data_q, params).fetchall()

        data = []
        for r in rows:
            row = r._mapping
            inst_type = row.get("INSTITUTION_TYPE")
            # Map project ID to label
            if str(inst_type) == str(COLLEGE_PROJECT_ID):
                inst_label = "College"
            elif str(inst_type) == str(SCHOOL_PROJECT_ID):
                inst_label = "High School"
            else:
                inst_label = str(inst_type) if inst_type else ""

            data.append({
                "id": row.get("id"),
                "from_batch_id": str(row.get("FROM_BATCH_ID") or ""),
                "to_batch_id": str(row.get("TO_BATCH_ID") or ""),
                "username": row.get("username") or "",
                "verification_source": row.get("VERIFICATION_SOURCE") or "",
                "INSTITUTION_TYPE": inst_label,
                "SOURCE_TYPE": (row.get("SOURCE_TYPE") or "").upper(),
                "created_time": str(row.get("CREATED_TIME") or ""),
            })

        return {
            "draw": draw,
            "recordsTotal": total_records,
            "recordsFiltered": total_records,
            "data": data,
        }
    except Exception as e:
        logger.error(f"batchassignajaxlist error: {e}")
        return {
            "draw": request.draw,
            "recordsTotal": 0,
            "recordsFiltered": 0,
            "data": [],
        }


# POST /api/ocrverify/assignbatches/save - Save assign batch data
@router.post("/assignbatches/save")
async def saveassignbatchdata(
    body: AssignBatchRequest,
    db: Session = Depends(get_db),
):
    """Save assign batch. CI: saveassignbatchdata -> ocrverify/Verifier/saveassignbatchdata."""
    try:
        verification_source = "ABBYY" if body.verification_source.upper() == "ABBYY" else "PORTAL"
        institution_type = COLLEGE_PROJECT_ID if body.INSTITUTION_TYPE.lower() == "college" else SCHOOL_PROJECT_ID

        # Insert into PORTAL_ASSIGN_BATCHS
        insert_q = text(f"""
            INSERT INTO {TBL_BATCH_ASSIGN_STG}
            (VERIFICATION_SOURCE, FROM_BATCH_ID, TO_BATCH_ID, INSTITUTION_TYPE, SOURCE_TYPE, USER_ID, CREATED_TIME)
            VALUES (:verification_source, :from_batch_id, :to_batch_id, :institution_type, :source_type, :user_id, :created_time)
        """)
        db.execute(insert_q, {
            "verification_source": verification_source,
            "from_batch_id": body.from_batch_id,
            "to_batch_id": body.to_batch_id,
            "institution_type": institution_type,
            "source_type": body.SOURCE_TYPE,
            "user_id": body.user_name,
            "created_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        })

        # Update VERIFICATION_SOURCE and STATUS_FLAG on batches in range
        # Get matching batch IDs from TRANSCRIPT_HDR_OCR joined with TRANSCRIPT_DOWNLOAD
        batch_q = text(f"""
            SELECT HOS.BATCH_ID
            FROM {TBL_TRANSCRIPTHDROCR} AS HOS
            INNER JOIN {TBL_DOWNLOAD} AS TD ON HOS.BATCH_ID = TD.BATCH_ID AND TD.SOURCE_TYPE = :source_type
            WHERE HOS.BATCH_ID >= :from_batch AND HOS.BATCH_ID <= :to_batch
            AND HOS.PROJECT_ID = :project_id AND HOS.STATUS_FLAG IS NULL
        """)
        batch_rows = db.execute(batch_q, {
            "source_type": body.SOURCE_TYPE,
            "from_batch": body.from_batch_id,
            "to_batch": body.to_batch_id,
            "project_id": institution_type,
        }).fetchall()

        if batch_rows:
            batch_ids = [str(r[0]) for r in batch_rows]
            if batch_ids:
                # Update HDR OCR
                ids_str = ",".join(batch_ids)
                update_hdr = text(f"""
                    UPDATE {TBL_TRANSCRIPTHDROCR}
                    SET VERIFICATION_SOURCE = :vsource, STATUS_FLAG = 'TOBEVERIFIED'
                    WHERE BATCH_ID IN ({ids_str})
                """)
                db.execute(update_hdr, {"vsource": verification_source})

                # Update line tables
                for line_tbl in (TBL_TRANSCRIPT_LINE_OCR_LEFT, TBL_TRANSCRIPT_LINE_OCR_RIGHT, TBL_TRANSCRIPT_LINE_OCR_MIDDLE):
                    update_line = text(f"""
                        UPDATE {line_tbl}
                        SET STATUS_FLAG = 'TOBEVERIFIED'
                        WHERE BATCH_ID IN ({ids_str})
                    """)
                    db.execute(update_line)

        db.commit()

        # CI3: updatePathToProcess() is called after insert.
        # Convert any FTP paths in TRANSCRIPT_HDR_OCR to network share paths.
        from helpers.common_helper import update_path_to_process
        update_path_to_process(db)

        return {"success": True, "message": "Batch assignment saved successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"saveassignbatchdata error: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving batch assignment: {str(e)}")


# POST /api/ocrverify/assignbatches/delete - Delete assigned batch
@router.post("/assignbatches/delete")
@router.delete("/assignbatches/delete")
async def delete_assgn_batch(
    body: DeleteBatchRequest,
    db: Session = Depends(get_db),
):
    """Delete assigned batch. CI: deleteAssgnBatch -> ocrverify/Verifier/deleteAssgnBatch."""
    try:
        delete_q = text(f"DELETE FROM {TBL_BATCH_ASSIGN_STG} WHERE id = :id")
        db.execute(delete_q, {"id": body.id})
        db.commit()
        return {"success": True, "message": "Batch assignment deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.error(f"delete_assgn_batch error: {e}")
        raise HTTPException(status_code=500, detail=f"Error deleting batch assignment: {str(e)}")


# GET /api/ocrverify/tobeassignbatches - To be assigned batches page
@router.get("/tobeassignbatches")
async def tobeassignbatches(db: Session = Depends(get_db)):
    """To be assigned batches. CI: ocrverify/Verifier/tobeassignbatches."""
    return {"message": "To be assigned batches", "data": []}


# POST /api/ocrverify/tobeassignbatches/ajaxlist - To be assigned batches DataTables list
@router.post("/tobeassignbatches/ajaxlist")
async def ajaxtobeassignbatchelist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """To be assigned batch list. CI: ajaxtobeassignbatchelist -> ocrverify/Verifier/ajaxtobeassignbatchelist."""
    return {
        "draw": request.draw,
        "recordsTotal": 0,
        "recordsFiltered": 0,
        "data": [],
    }
