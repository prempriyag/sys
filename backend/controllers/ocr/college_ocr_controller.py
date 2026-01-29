"""
OCR Verify - College OCR Data controller.
CI: Collegeocrdata - index, searchbatch, updatebatchdataline, updatebatchdatahdr,
    deletelinedata, changeBatchVerifyStatus, changeAdditionalStatus, deletesequence,
    multiple_update, reassign_verifier, verifierbatches, ajaxverifierbatchelist.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Any
from pydantic import BaseModel

from database.connection import get_db
from models.college_verifier_model import CollegeVerifierModel
from config.constants import TBL_TRANSCRIPTHDROCR, COLLEGE_PROJECT_ID

router = APIRouter(prefix="/api/ocrverify", tags=["ocr-college"])


def _null_if_empty(val: Any) -> Optional[str]:
    if val is None or val == "" or (isinstance(val, str) and val.upper() == "NULL"):
        return None
    return val if not isinstance(val, str) else val


# --- Request/Response schemas ---

class DataTableRequest(BaseModel):
    draw: int = 1
    start: int = 0
    length: int = 10
    search: dict = {}
    order: list = []
    columns: list = []
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None
    institution_name: Optional[str] = None
    username: Optional[str] = None
    fromdate: Optional[str] = None
    todate: Optional[str] = None


class UpdateBatchDataLineRequest(BaseModel):
    BATCH_ID: str
    AUTO_SEQNO: Optional[Any] = None  # int or empty for new row
    SUBJECT: Optional[str] = None
    COURSE_ID: Optional[str] = None
    COURSE_TITLE: Optional[str] = None
    START_TERM: Optional[str] = None
    END_TERM: Optional[str] = None
    EXTERNAL_INSTITUTION_NAME: Optional[str] = None
    CREDIT_HOURS_EARNED: Optional[str] = None
    GRADE: Optional[str] = None
    PAGE_NBR: Optional[str] = None
    Type: str = "left"  # left | right | middle


class DeleteLineDataRequest(BaseModel):
    BATCH_ID: str
    AUTO_SEQNO: int
    Type: str = "left"


class DeleteSequenceRequest(BaseModel):
    sequencerow_ids: List[int]
    table: str  # left | right | middle


class ChangeBatchVerifyStatusRequest(BaseModel):
    status: str
    type: str  # is_transcript | is_tsu_transcript | etc.
    batch_id: str


class ChangeAdditionalStatusRequest(BaseModel):
    status: str
    type: str
    traType: str  # YES = TRANSCRIPT_TYPE, else STATUS_FLAG
    batch_id: str


class ReassignVerifierRequest(BaseModel):
    batchs_list: List[str]
    reassign_user: str


# --- Batch index / getEditBatchs (simplified: return batch data for a batch_id) ---

@router.get("/collegeocrbatch")
async def collegeocrbatch(
    batch_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """College OCR batch index. CI: ocrverify/collegeocrdata/index. Returns batch data for batch_id."""
    if not batch_id:
        return {"message": "College OCR batch", "batch_id": None, "hdr_data": None, "right_data": [], "left_data": [], "middle_data": [], "line_data": [], "right": [], "error_msg": False}
    try:
        # Fetch hdr_data
        hdr = db.execute(
            text(f"SELECT * FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE BATCH_ID = :bid AND PROJECT_ID = :pid"),
            {"bid": batch_id, "pid": COLLEGE_PROJECT_ID},
        ).fetchone()
        hdr_data = dict(hdr._mapping) if hdr else None
        if not hdr_data:
            return {"batch_id": batch_id, "hdr_data": None, "error_msg": True}
        file_path = hdr_data.get("FILE_PATH") or ""
        if file_path:
            try:
                from helpers.encryption_helper import get_encrypt_file_path
                encrypted_path = get_encrypt_file_path(file_path)
                hdr_data["TRANSCRIPT_URL"] = f"/api/viewfile/transcript_file?pdf={encrypted_path}"
            except Exception:
                hdr_data["TRANSCRIPT_URL"] = ""
        else:
            hdr_data["TRANSCRIPT_URL"] = ""

        # Left, right, middle line data
        left_data = db.execute(
            text(f"SELECT AUTO_SEQNO, EXTERNAL_INSTITUTION_NAME, SUBJECT, COURSE_ID, COURSE_TITLE, START_TERM, END_TERM, CREDIT_HOURS_EARNED, GRADE, BOT_Verification, BOT_OCR_VERIFICATION, PAGE_NBR FROM {TBL_TRANSCRIPT_LINE_OCR_LEFT} WITH(NOLOCK) WHERE BATCH_ID = :bid ORDER BY AUTO_SEQNO"),
            {"bid": batch_id},
        ).fetchall()
        right_data = db.execute(
            text(f"SELECT AUTO_SEQNO, EXTERNAL_INSTITUTION_NAME, SUBJECT, COURSE_ID, COURSE_TITLE, START_TERM, END_TERM, CREDIT_HOURS_EARNED, GRADE, BOT_Verification, BOT_OCR_VERIFICATION, PAGE_NBR FROM {TBL_TRANSCRIPT_LINE_OCR_RIGHT} WITH(NOLOCK) WHERE BATCH_ID = :bid ORDER BY AUTO_SEQNO"),
            {"bid": batch_id},
        ).fetchall()
        middle_data = db.execute(
            text(f"SELECT AUTO_SEQNO, EXTERNAL_INSTITUTION_NAME, SUBJECT, COURSE_ID, COURSE_TITLE, START_TERM, END_TERM, CREDIT_HOURS_EARNED, GRADE, BOT_Verification, BOT_OCR_VERIFICATION, PAGE_NBR FROM {TBL_TRANSCRIPT_LINE_OCR_MIDDLE} WITH(NOLOCK) WHERE BATCH_ID = :bid ORDER BY AUTO_SEQNO"),
            {"bid": batch_id},
        ).fetchall()

        def row_list(rows):
            return [dict(r._mapping) for r in rows]

        return {
            "batch_id": batch_id,
            "hdr_data": hdr_data,
            "right_data": row_list(right_data),
            "left_data": row_list(left_data),
            "middle_data": row_list(middle_data),
            "line_data": [],
            "right": [],
            "error_msg": False,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collegeocrbatches")
async def collegeocrbatches(db: Session = Depends(get_db)):
    """College verifier batches page. CI: verifierbatches."""
    return {"message": "College OCR assigned batches", "verifiers": []}


@router.post("/collegeocr/ajaxverifierbatchelist")
async def collegeocr_ajaxverifierbatchelist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """College OCR verifier batch list. CI: ajaxverifierbatchelist. Returns DataTables payload (recordsTotal, recordsFiltered, data)."""
    try:
        # Stub: return empty DataTables response; full implementation would use getallverifierbatchdata
        return {
            "draw": request.draw,
            "recordsTotal": 0,
            "recordsFiltered": 0,
            "data": [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collegeocrbatch/search")
async def collegeocrbatchsearch(
    body: dict,
    db: Session = Depends(get_db),
):
    """Redirect equivalent: return batch_id for client redirect. CI: searchbatch."""
    batch_id = body.get("batch_id")
    return {"batch_id": batch_id, "redirect": f"/ocrverify/collegeocrbatch?batch_id={batch_id}" if batch_id else None}


# --- Mutations ---

@router.post("/updatebatchdataline")
async def updatebatchdataline(
    body: UpdateBatchDataLineRequest,
    db: Session = Depends(get_db),
):
    """Update or insert one line. CI: updatebatchdataline."""
    try:
        table = CollegeVerifierModel.get_table_for_type(body.Type)
        data = {
            "SUBJECT": _null_if_empty(body.SUBJECT),
            "COURSE_ID": _null_if_empty(body.COURSE_ID),
            "COURSE_TITLE": _null_if_empty(body.COURSE_TITLE),
            "START_TERM": _null_if_empty(body.START_TERM),
            "END_TERM": _null_if_empty(body.END_TERM),
            "EXTERNAL_INSTITUTION_NAME": _null_if_empty(getattr(body, "EXTERNAL_INSTITUTION_NAME", None)),
            "CREDIT_HOURS_EARNED": _null_if_empty(body.CREDIT_HOURS_EARNED),
            "GRADE": _null_if_empty(body.GRADE),
            "PAGE_NBR": _null_if_empty(body.PAGE_NBR),
        }
        data = {k: v for k, v in data.items() if v is not None}
        auto_seq = body.AUTO_SEQNO
        if auto_seq is not None and auto_seq != "":
            try:
                seq_int = int(auto_seq)
            except (TypeError, ValueError):
                seq_int = 0
            CollegeVerifierModel.update_line_ocr_data(
                db, table, body.BATCH_ID, seq_int, data
            )
            return auto_seq
        else:
            data["BATCH_ID"] = body.BATCH_ID
            new_id = CollegeVerifierModel.save_line_ocr_data(db, table, data)
            return new_id
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/updatebatchdatahdr")
async def updatebatchdatahdr(body: dict, db: Session = Depends(get_db)):
    """Update header row. CI: updatebatchdatahdr."""
    try:
        batch_id = body.get("BATCH_ID")
        if not batch_id:
            raise HTTPException(status_code=400, detail="BATCH_ID required")
        keys_allow = [
            "FILE_NAME", "EXTERNAL_INSTITUTION_NAME", "STUDENT_FULL_NAME", "CEEB_CODE",
            "CGPA", "TOTAL_CREDITS_ATTENDED", "EXTERNAL_INSTITUTION_ZIPCODE", "DATE_OF_BIRTH",
            "SSN", "DEGREE", "DEGREE_RECEIVED_DATE", "SECOND_DEGREE_NAME", "SECOND_DEGREE_RECEIVED_DATE",
            "TOTAL_CREDITS_EARNED", "WEIGHTED_GPA", "UNWEIGHTED_GPA", "CLASS_RANK", "CLASS_SIZE",
            "UNWEIGHTED_RANK", "UNWEIGHTED_CLASS_SIZE", "ENDORSEMENT_FLAG", "Dual_Credit_Flag",
            "INTERNATIONAL_FLAG", "AP_CREDITS_YN", "CLEP_CREDITS_YN", "WEIGHTED_GPA_SCALE",
            "UNWEIGHTED_GPA_SCALE", "CGPA_SCALE",
        ]
        data = {}
        for k in keys_allow:
            if k in body:
                data[k] = _null_if_empty(body[k])
        if not data:
            return {"code": 1, "message": "Header data updated successfully"}
        CollegeVerifierModel.update_hdr_ocr_data(db, batch_id, data)
        return {"code": 1, "message": "Header data updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deletelinedata")
async def deletelinedata(
    body: DeleteLineDataRequest,
    db: Session = Depends(get_db),
):
    """Delete one line. CI: deletelinedata."""
    try:
        table = CollegeVerifierModel.get_table_for_type(body.Type)
        CollegeVerifierModel.delete_line_data(db, table, body.BATCH_ID, body.AUTO_SEQNO)
        return "Success"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/changeBatchVerifyStatus")
async def change_batch_verify_status(
    body: ChangeBatchVerifyStatusRequest,
    db: Session = Depends(get_db),
):
    """Change batch verify status. CI: changeBatchVerifyStatus."""
    try:
        status = body.status
        t = body.type
        batch_id = body.batch_id
        if not status or not batch_id:
            return "Error"
        if t == "is_transcript":
            data = {
                "STATUS_FLAG": "TOBEVERIFIED" if status == "YES" else "NOT A HIGHSCHOOL TRANSCRIPT",
                "IS_TRANSCRIPT": status,
            }
            data_line = {"STATUS_FLAG": "TOBEVERIFIED" if status == "YES" else "NOT A HIGHSCHOOL TRANSCRIPT"}
        elif t == "is_tsu_transcript":
            data = data_line = {"STATUS_FLAG": "To Be Reviewed By OSU-OKC" if status == "YES" else "TOBEVERIFIED"}
        else:
            data = data_line = {"STATUS_FLAG": status}
        ok = CollegeVerifierModel.update_verify_status(db, batch_id, data, data_line)
        return "Success" if ok else "Error"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/changeAdditionalStatus")
async def change_additional_status(
    body: ChangeAdditionalStatusRequest,
    db: Session = Depends(get_db),
):
    """Change additional status (TRANSCRIPT_TYPE or STATUS_FLAG). CI: changeAdditionalStatus."""
    try:
        if body.traType == "YES":
            data = {"TRANSCRIPT_TYPE": body.status}
            data_line = []
        else:
            data = {"STATUS_FLAG": body.status}
            data_line = {"STATUS_FLAG": body.status}
        ok = CollegeVerifierModel.update_verify_status(
            db, body.batch_id, data, data_line if isinstance(data_line, dict) else None
        )
        return "Success" if ok else "Error"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/deletesequence")
async def deletesequence(
    body: DeleteSequenceRequest,
    db: Session = Depends(get_db),
):
    """Delete multiple rows by AUTO_SEQNO. CI: deletesequence."""
    try:
        table = CollegeVerifierModel.get_table_for_type(body.table)
        CollegeVerifierModel.delete_sequence(db, table, body.sequencerow_ids)
        return 1
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/multiple_update")
async def multiple_update(
    body: dict,
    db: Session = Depends(get_db),
):
    """Bulk update/insert lines. CI: multiple_update."""
    try:
        table_name = body.get("table", "left")
        table = CollegeVerifierModel.get_table_for_type(table_name)
        post_data = {k: v for k, v in body.items() if k != "table"}
        if not post_data:
            return {"code": 500, "message": "Please choose the row to edit"}
        res = CollegeVerifierModel.update_sequence(db, table, post_data)
        return {
            "code": 1,
            "message": "Rows are Updated",
            "result": res.get("auto_seq", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collegeocr/reassign_verifier")
async def collegeocr_reassign_verifier(
    body: ReassignVerifierRequest,
    db: Session = Depends(get_db),
):
    """Reassign batches to a verifier. CI: reassign_verifier."""
    try:
        from datetime import datetime
        verifier = body.reassign_user  # email or user id
        for batch_id in body.batchs_list or []:
            row = db.execute(
                text(
                    f"SELECT BATCH_ID, PORTAL_VERIFIER_NAME, VERIFIED_IN_ABBYY, PREVIOUS_VERIFIER FROM {TBL_TRANSCRIPTHDROCR} WHERE BATCH_ID = :bid"
                ),
                {"bid": batch_id},
            ).fetchone()
            if not row:
                continue
            current_data = {
                "PORTAL_VERIFIER_NAME": row.PORTAL_VERIFIER_NAME or "",
                "VERIFIED_IN_ABBYY": row.VERIFIED_IN_ABBYY or "",
                "LAST_UPDATED_BY": None,
                "LAST_UPDATED_AT": datetime.utcnow().isoformat(),
            }
            prev = row.PREVIOUS_VERIFIER
            import json
            previous_list = json.loads(prev) if prev else []
            previous_list.append(current_data)
            db.execute(
                text(
                    f"UPDATE {TBL_TRANSCRIPTHDROCR} SET VERIFIED_IN_ABBYY = 'NO', PORTAL_VERIFIER_NAME = :verifier, PREVIOUS_VERIFIER = :prev WHERE BATCH_ID = :bid"
                ),
                {"verifier": verifier, "prev": json.dumps(previous_list), "bid": batch_id},
            )
        db.commit()
        return {"success": True, "message": "Verifier reassigned"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
