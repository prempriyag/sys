"""
OCR Verify - School OCR Data controller.
CI routes: schoolocrbatch, schoolocrbatchsearch, changeAdditionalStatus (shared),
           updatebatchdataocr (header), schoolocr/updatebatchdataline, schooldeletelinedata,
           schoolocrbatches, schoolocr/ajaxverifierbatchelist
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Any
from pydantic import BaseModel

from database.connection import get_db
from models.college_verifier_model import CollegeVerifierModel
from config.constants import SCHOOL_PROJECT_ID

router = APIRouter(prefix="/api/ocrverify", tags=["ocr-school"])


def _null_if_empty(val: Any) -> Optional[str]:
    if val is None or val == "" or (isinstance(val, str) and val.upper() == "NULL"):
        return None
    return val if not isinstance(val, str) else val


class DataTableRequest(BaseModel):
    draw: int = 1
    start: int = 0
    length: int = 10
    search: dict = {}
    order: list = []
    columns: list = []
    fieldType: Optional[str] = None
    fieldName: Optional[str] = None
    username: Optional[str] = None
    institution_name: Optional[str] = None
    fromdate: Optional[str] = None
    todate: Optional[str] = None


class SchoolUpdateLineRequest(BaseModel):
    BATCH_ID: str
    AUTO_SEQNO: Optional[Any] = None  # empty for insert
    TEST_TYPE: Optional[str] = None
    TEST_DATE: Optional[str] = None
    SUBJECT: Optional[str] = None
    SCORE: Optional[str] = None
    PAGE_NBR: Optional[str] = None
    Type: str = "left"  # School uses single table; Type left/middle/right for compatibility


class SchoolDeleteLineRequest(BaseModel):
    BATCH_ID: str
    AUTO_SEQNO: int
    Type: str = "left"


# GET /api/ocrverify/schoolocrbatch - School OCR batch (hdr_data + line_data)
@router.get("/schoolocrbatch")
async def schoolocrbatch(
    batch_id: Optional[str] = Query(None, alias="batch_id"),
    db: Session = Depends(get_db),
):
    """School OCR batch. CI: ocrverify/schooleditocr/index. Returns hdr_data + line_data (test scores)."""
    if not batch_id:
        return {"message": "School OCR batch", "batch_id": None, "hdr_data": None, "line_data": [], "error_msg": True}
    try:
        result = CollegeVerifierModel.get_edit_school_batchs(db, batch_id)
        return {
            "batch_id": result["batch_id"],
            "hdr_data": result["hdr_data"],
            "line_data": result.get("line_data", []),
            "error_msg": result.get("error_msg", True),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ocrverify/schoolocrbatch/search - School OCR batch search redirect
@router.post("/schoolocrbatch/search")
async def schoolocrbatchsearch(body: dict, db: Session = Depends(get_db)):
    """School OCR batch search. CI: ocrverify/schoolocrbatchsearch."""
    bid = body.get("batch_id")
    return {"batch_id": bid, "redirect": f"/ocrverify/schoolocrbatch?batch_id={bid}" if bid else None}


# GET /api/ocrverify/schoolocrbatches - School assigned batches page (index)
@router.get("/schoolocrbatches")
async def schoolocrbatches(db: Session = Depends(get_db)):
    """School verifier batches index. CI: ocrverify/schooleditocr/verifierbatches."""
    return {"message": "School OCR assigned batches", "data": []}


# POST /api/ocrverify/schoolocr/ajaxverifierbatchelist - School verifier batch DataTables list
@router.post("/schoolocr/ajaxverifierbatchelist")
async def schoolocr_ajaxverifierbatchelist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """School OCR verifier batch list. CI: schoolocr/ajaxverifierbatchelist."""
    try:
        request_data = request.model_dump() if hasattr(request, "model_dump") else request.dict()
        return CollegeVerifierModel.get_all_verifier_batch_data(db, request_data, SCHOOL_PROJECT_ID)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ocrverify/schoolocr/updatebatchdataline - School OCR update/insert test score line
@router.post("/schoolocr/updatebatchdataline")
async def schoolocr_updatebatchdataline(
    body: SchoolUpdateLineRequest,
    db: Session = Depends(get_db),
):
    """School OCR update or insert one test score line. CI: ocrverify/Schoolocrdata/updatebatchdataline."""
    try:
        data = {
            "TEST_TYPE": _null_if_empty(body.TEST_TYPE),
            "TEST_DATE": _null_if_empty(body.TEST_DATE),
            "SUBJECT": _null_if_empty(body.SUBJECT),
            "SCORE": _null_if_empty(body.SCORE),
            "PAGE_NBR": _null_if_empty(body.PAGE_NBR),
        }
        data = {k: v for k, v in data.items() if v is not None}
        auto_seq = body.AUTO_SEQNO
        if auto_seq is not None and auto_seq != "":
            try:
                seq_int = int(auto_seq)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Invalid AUTO_SEQNO")
            CollegeVerifierModel.update_line_test_score_ocr(db, body.BATCH_ID, seq_int, data)
            return auto_seq
        else:
            data["BATCH_ID"] = body.BATCH_ID
            new_id = CollegeVerifierModel.save_line_test_score_ocr(db, data)
            return new_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ocrverify/schooldeletelinedata - School OCR delete test score line
@router.post("/schooldeletelinedata")
async def school_deletelinedata(
    body: SchoolDeleteLineRequest,
    db: Session = Depends(get_db),
):
    """School delete one test score line. CI: ocrverify/schooldeletelinedata."""
    try:
        CollegeVerifierModel.delete_line_test_score_ocr(db, body.BATCH_ID, body.AUTO_SEQNO)
        return "Success"
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ocrverify/updatebatchdataocr - School OCR update batch header (TBL_TRANSCRIPTHDROCR)
@router.post("/updatebatchdataocr")
async def updatebatchdataocr(body: dict, db: Session = Depends(get_db)):
    """School OCR update header. CI: ocrverify/schoolocrdata/updatebatchdatahdr."""
    try:
        batch_id = body.get("BATCH_ID")
        if not batch_id:
            raise HTTPException(status_code=400, detail="BATCH_ID required")
        keys_allow = [
            "FILE_NAME", "EXTERNAL_INSTITUTION_NAME", "STUDENT_FULL_NAME", "CEEB_CODE",
            "EXTERNAL_INSTITUTION_ZIPCODE", "DATE_OF_BIRTH", "SSN", "DEGREE_RECEIVED_DATE",
            "TOTAL_CREDITS_EARNED", "WEIGHTED_GPA_SCALE", "WEIGHTED_GPA", "UNWEIGHTED_GPA_SCALE",
            "UNWEIGHTED_GPA", "CGPA_SCALE", "CGPA", "WEIGHTED_CLASS_RANK", "WEIGHTED_CLASS_SIZE",
            "UNWEIGHTED_CLASS_RANK", "UNWEIGHTED_CLASS_SIZE", "CGPA_CLASS_RANK", "CGPA_CLASS_SIZE",
            "IMMUNIZATION_FLAG", "ACT_FLAG", "SAT_FLAG", "INTERNATIONAL_FLAG",
        ]
        data = {}
        for k in keys_allow:
            if k in body:
                data[k] = _null_if_empty(body[k])
        if "UNWEIGHTED_RANK" in body:
            data["UNWEIGHTED_CLASS_RANK"] = _null_if_empty(body["UNWEIGHTED_RANK"])
        if not data:
            return {"code": 1, "message": "Header data updated successfully"}
        CollegeVerifierModel.update_hdr_ocr_data(db, batch_id, data)
        return {"code": 1, "message": "Header data updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ocrverify/schooldeletesequence
@router.post("/schooldeletesequence")
async def school_deletesequence(body: dict, db: Session = Depends(get_db)):
    """School bulk delete test score rows. CI: ocrverify/schooldeletesequence. Body: BATCH_ID, sequencerow_ids[], table."""
    try:
        batch_id = body.get("BATCH_ID")
        ids = body.get("sequencerow_ids") or []
        if not batch_id:
            raise HTTPException(status_code=400, detail="BATCH_ID required")
        sequencerow_ids = [int(x) for x in ids if x != "" and x is not None]
        if not sequencerow_ids:
            return {"success": True, "message": "No rows to delete"}
        CollegeVerifierModel.delete_sequence_test_score_ocr(db, batch_id, sequencerow_ids)
        return {"success": True, "message": "Sequence deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST /api/ocrverify/schoolocr/reassign_verifier
@router.post("/schoolocr/reassign_verifier")
async def schoolocr_reassign_verifier(body: dict, db: Session = Depends(get_db)):
    """School OCR reassign batches to verifier. CI: schoolocr/reassign_verifier (or collegeocr)."""
    # Stub: same logic as college reassign; batchs_list and reassign_user
    return "Success"


# POST /api/ocrverify/school_multiple_update
@router.post("/school_multiple_update")
async def school_multiple_update(body: dict, db: Session = Depends(get_db)):
    """School bulk update/insert test score lines. CI: school_multiple_update. Body: BATCH_ID, table, AUTO_SEQNO[], TEST_TYPE[], etc."""
    try:
        batch_id = body.get("BATCH_ID") or ""
        if not batch_id:
            raise HTTPException(status_code=400, detail="BATCH_ID required")
        post_data = {k: v for k, v in body.items() if k not in ("table", "BATCH_ID")}
        if not post_data or not (post_data.get("AUTO_SEQNO") or post_data.get("TEST_TYPE")):
            return {"code": 0, "message": "Please choose the row to edit", "result": None}
        res = CollegeVerifierModel.update_sequence_test_score_ocr(db, batch_id, {**post_data, "BATCH_ID": batch_id})
        return {"code": 1, "message": "Rows are Updated", "result": res.get("auto_seq", [])}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
