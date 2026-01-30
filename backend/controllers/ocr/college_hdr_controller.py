"""
OCR Verify - College HDR Data controller.
CI routes: collegehdrdata, ajaxcollegehdrlist, collegehdrbatch (collegehdrdata_view),
updatebatchdatahdr, updatebatchdataline, deletelinedata.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Any
from pydantic import BaseModel, Field

from database.connection import get_db
from models.college_hdr_data_model import CollegeHdrDataModel
from models.college_verifier_model import CollegeVerifierModel

router = APIRouter(prefix="/api/ocrverify", tags=["ocr-college-hdr"])


def _null_val(v: Optional[str]) -> Optional[str]:
    if v is None or v == "" or (isinstance(v, str) and v.upper() == "NULL"):
        return None
    return v


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class DataTableRequest(BaseModel):
    draw: int = 1
    start: int = 0
    length: int = 10
    search: dict = {}
    order: list = []
    columns: list = []
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None


class UpdateBatchDataHdrRequest(BaseModel):
    BATCH_ID: str
    INSTITUTION_ID: Optional[str] = None
    STUDENT_FULL_NAME: Optional[str] = None
    STUDENT_FIRST_NAME: Optional[str] = None
    STUDENT_MIDDLE_NAME: Optional[str] = None
    STUDENT_LAST_NAME: Optional[str] = None
    EXTERNAL_INSTITUTION_ZIPCODE: Optional[str] = None
    DATE_OF_BIRTH: Optional[str] = None
    SSN: Optional[str] = None
    TOTAL_CREDITS_EARNED: Optional[str] = None
    Dual_Credit_Flag: Optional[str] = None
    INTERNATIONAL_FLAG: Optional[str] = None
    AP_CREDITS_YN: Optional[str] = None
    CLEP_CREDITS_YN: Optional[str] = None
    ENDORSEMENT_FLAG: Optional[str] = None
    WEIGHTED_GPA_SCALE: Optional[str] = None
    WEIGHTED_GPA: Optional[str] = None
    UNWEIGHTED_GPA_SCALE: Optional[str] = None
    UNWEIGHTED_GPA: Optional[str] = None
    CGPA_SCALE: Optional[str] = None
    CGPA: Optional[str] = None
    WEIGHTED_CLASS_RANK: Optional[str] = None
    WEIGHTED_CLASS_SIZE: Optional[str] = None
    UNWEIGHTED_CLASS_RANK: Optional[str] = None
    UNWEIGHTED_CLASS_SIZE: Optional[str] = None


class UpdateBatchDataLineRequest(BaseModel):
    BATCH_ID: str
    AUTO_SEQNO: Optional[str] = None  # empty for insert
    COURSE_ID: Optional[str] = None
    COURSE_TITLE: Optional[str] = None
    SUBJECT: Optional[str] = None
    START_TERM: Optional[str] = None
    END_TERM: Optional[str] = None
    CREDIT_HOURS_EARNED: Optional[str] = None
    GRADE: Optional[str] = None
    PAGE_NBR: Optional[str] = None
    Type: Optional[str] = None


class DeleteLineDataRequest(BaseModel):
    BATCH_ID: str
    AUTO_SEQNO: str
    Type: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /api/ocrverify/collegehdrdata - College header data index
# ---------------------------------------------------------------------------
@router.get("/collegehdrdata")
async def collegehdrdata(db: Session = Depends(get_db)):
    """College HDR data index: verifiers list and distinct STATUS_FLAG. CI: ocrverify/collegehdrdata/index."""
    verifiers = CollegeVerifierModel.get_verifiers_list(db)
    hdr_status = CollegeHdrDataModel.get_distinct_status_flags(db)
    return {
        "verifiers": verifiers,
        "HDR_STATUS": hdr_status,
    }


# ---------------------------------------------------------------------------
# POST /api/ocrverify/collegehdrdata/ajaxlist - College HDR DataTables list
# ---------------------------------------------------------------------------
@router.post("/collegehdrdata/ajaxlist")
async def ajaxcollegehdrlist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """College HDR list for DataTables. CI: ocrverify/collegehdrdata/ajaxlist."""
    request_data = {
        "draw": request.draw,
        "start": request.start,
        "length": request.length,
        "search": request.search,
        "order": request.order,
        "columns": request.columns,
        "fieldType": request.fieldType,
        "fieldName": request.fieldName,
    }
    return CollegeHdrDataModel.get_college_hdr_data(
        db=db,
        request_data=request_data,
        has_update_permission=True,
    )


# ---------------------------------------------------------------------------
# GET /api/ocrverify/collegehdrbatch - College HDR batch view
# ---------------------------------------------------------------------------
@router.get("/collegehdrbatch")
async def collegehdrbatch(
    batch_id: Optional[str] = Query(None, alias="batch_id"),
    verify: Optional[str] = Query("no", alias="verify"),
    db: Session = Depends(get_db),
):
    """College HDR batch view for editing. CI: ocrverify/collegehdrdata/collegehdrdata_view."""
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")
    response = CollegeHdrDataModel.get_hdr_batchs(db, batch_id, verify)
    if response.get("batch_id") == 0:
        raise HTTPException(status_code=404, detail="Batch not found or access denied")
    return {
        "batch_id": response["batch_id"],
        "prev_batch_id": response.get("prev_batch_id"),
        "next_batch_id": response.get("next_batch_id"),
        "rec": response.get("rec"),
        "linedata": response.get("linedata", []),
    }


# ---------------------------------------------------------------------------
# POST /api/ocrverify/collegehdrdata/updatebatchdatahdr
# ---------------------------------------------------------------------------
@router.post("/collegehdrdata/updatebatchdatahdr")
async def updatebatchdatahdr(
    body: UpdateBatchDataHdrRequest,
    db: Session = Depends(get_db),
):
    """Update TBL_TRANSCRIPTHDRDATA by BATCH_ID. CI: Collegehdrdata::updatebatchdatahdr."""
    data = {
        "INSTITUTION_ID": _null_val(body.INSTITUTION_ID),
        "STUDENT_FULL_NAME": _null_val(body.STUDENT_FULL_NAME),
        "STUDENT_FIRST_NAME": _null_val(body.STUDENT_FIRST_NAME),
        "STUDENT_MIDDLE_NAME": _null_val(body.STUDENT_MIDDLE_NAME),
        "STUDENT_LAST_NAME": _null_val(body.STUDENT_LAST_NAME),
        "EXTERNAL_INSTITUTION_ZIPCODE": _null_val(body.EXTERNAL_INSTITUTION_ZIPCODE),
        "DATE_OF_BIRTH": _null_val(body.DATE_OF_BIRTH),
        "SSN": _null_val(body.SSN),
        "TOTAL_CREDITS_EARNED": _null_val(body.TOTAL_CREDITS_EARNED),
        "DUAL_CREDIT_FLAG": _null_val(body.Dual_Credit_Flag),
        "INTERNATIONAL_FLAG": _null_val(body.INTERNATIONAL_FLAG),
        "ENDORSEMENT_FLAG": _null_val(body.ENDORSEMENT_FLAG),
        "AP_CREDITS_YN": _null_val(body.AP_CREDITS_YN),
        "CLEP_CREDITS_YN": _null_val(body.CLEP_CREDITS_YN),
        "WEIGHTED_GPA_SCALE": _null_val(body.WEIGHTED_GPA_SCALE),
        "WEIGHTED_GPA": _null_val(body.WEIGHTED_GPA),
        "UNWEIGHTED_GPA": _null_val(body.UNWEIGHTED_GPA),
        "UNWEIGHTED_GPA_SCALE": _null_val(body.UNWEIGHTED_GPA_SCALE),
        "CGPA": _null_val(body.CGPA),
        "CGPA_SCALE": _null_val(body.CGPA_SCALE),
        "WEIGHTED_CLASS_RANK": _null_val(body.WEIGHTED_CLASS_RANK),
        "WEIGHTED_CLASS_SIZE": _null_val(body.WEIGHTED_CLASS_SIZE),
        "UNWEIGHTED_CLASS_RANK": _null_val(body.UNWEIGHTED_CLASS_RANK),
        "UNWEIGHTED_CLASS_SIZE": _null_val(body.UNWEIGHTED_CLASS_SIZE),
    }
    CollegeHdrDataModel.update_hdr_data(db, body.BATCH_ID, data)
    return {"code": 1, "message": "Header data updated successfully"}


# ---------------------------------------------------------------------------
# POST /api/ocrverify/collegehdrdata/updatebatchdataline
# ---------------------------------------------------------------------------
@router.post("/collegehdrdata/updatebatchdataline")
async def updatebatchdataline(
    body: UpdateBatchDataLineRequest,
    db: Session = Depends(get_db),
):
    """Update or insert one line in TBL_TRANSCRIPTLINEDATA. CI: Collegehdrdata::updatebatchdataline."""
    data = {
        "COURSE_ID": _null_val(body.COURSE_ID),
        "COURSE_TITLE": _null_val(body.COURSE_TITLE),
        "SUBJECT": _null_val(body.SUBJECT),
        "START_TERM": _null_val(body.START_TERM),
        "END_TERM": _null_val(body.END_TERM),
        "CREDIT_HOURS_EARNED": _null_val(body.CREDIT_HOURS_EARNED),
        "GRADE": _null_val(body.GRADE),
        "PAGE_NBR": _null_val(body.PAGE_NBR),
    }
    auto_seqno = body.AUTO_SEQNO
    if auto_seqno and str(auto_seqno).strip() != "":
        CollegeHdrDataModel.update_line_hdr_data(
            db, body.BATCH_ID, int(auto_seqno), data
        )
        return int(auto_seqno)
    else:
        data["BATCH_ID"] = body.BATCH_ID
        insert_id = CollegeHdrDataModel.save_line_hdr_data(db, data)
        return insert_id


# ---------------------------------------------------------------------------
# POST /api/ocrverify/collegehdrdata/deletelinedata
# ---------------------------------------------------------------------------
@router.post("/collegehdrdata/deletelinedata")
async def deletelinedata(
    body: DeleteLineDataRequest,
    db: Session = Depends(get_db),
):
    """Delete one line from TBL_TRANSCRIPTLINEDATA. CI: Collegehdrdata::deletelinedata."""
    CollegeHdrDataModel.delete_line_data(db, body.BATCH_ID, int(body.AUTO_SEQNO))
    return "Success"
