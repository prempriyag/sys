"""
OCR Verify - School HDR Data controller.
CI routes: schoolhdrdata, ajaxschoolhdrlist, schoolhdrbatch (schoolhdrdata_view), schoolhdrdata/updatebatchdatahdr
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel

from database.connection import get_db
from models.college_hdr_data_model import CollegeHdrDataModel
from models.college_verifier_model import CollegeVerifierModel

router = APIRouter(prefix="/api/ocrverify", tags=["ocr-school-hdr"])


def _null_val(v: Optional[str]) -> Optional[str]:
    if v is None or v == "" or (isinstance(v, str) and v.upper() == "NULL"):
        return None
    return v


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


# GET /api/ocrverify/schoolhdrdata - School header data index
@router.get("/schoolhdrdata")
async def schoolhdrdata(db: Session = Depends(get_db)):
    """School HDR data index: verifiers list and distinct STATUS_FLAG. CI: ocrverify/schoolhdrdata/index."""
    verifiers = CollegeVerifierModel.get_verifiers_list(db)
    hdr_status = CollegeHdrDataModel.get_distinct_status_flags(db)
    return {
        "verifiers": verifiers,
        "HDR_STATUS": hdr_status,
    }


# POST /api/ocrverify/schoolhdrdata/ajaxlist - School HDR DataTables list
@router.post("/schoolhdrdata/ajaxlist")
async def ajaxschoolhdrlist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """School HDR list for DataTables. CI: ocrverify/schoolhdrdata/ajaxlist."""
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
    return CollegeHdrDataModel.get_school_hdr_data(
        db=db,
        request_data=request_data,
        has_update_permission=True,
    )


# GET /api/ocrverify/schoolhdrbatch - School HDR batch view
@router.get("/schoolhdrbatch")
async def schoolhdrbatch(
    batch_id: Optional[str] = Query(None, alias="batch_id"),
    verify: Optional[str] = Query("no", alias="verify"),
    db: Session = Depends(get_db),
):
    """School HDR batch view for editing. CI: ocrverify/schoolhdrdata/schoolhdrdata_view."""
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")
    response = CollegeHdrDataModel.get_hdr_school_batchs(db, batch_id, verify)
    if response.get("batch_id") == 0:
        raise HTTPException(status_code=404, detail="Batch not found or access denied")
    return {
        "batch_id": response["batch_id"],
        "prev_batch_id": response.get("prev_batch_id"),
        "next_batch_id": response.get("next_batch_id"),
        "rec": response.get("rec"),
        "linedata": response.get("linedata", []),
    }


# POST /api/ocrverify/schoolhdrdata/updatebatchdatahdr - School HDR update batch header
@router.post("/schoolhdrdata/updatebatchdatahdr")
async def updatebatchdatahdr(
    body: UpdateBatchDataHdrRequest,
    db: Session = Depends(get_db),
):
    """Update TBL_TRANSCRIPTHDRDATA by BATCH_ID (School HDR). CI: ocrverify/schoolhdrdata/updatebatchdatahdr."""
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
