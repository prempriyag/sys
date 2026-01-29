"""
OCR Verify - Verifier controller.
CI routes: verifiers, assignbatches, batchassignajaxlist, saveassignbatchdata, deleteAssgnBatch,
           tobeassignbatches, ajaxtobeassignbatchelist
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List, Any
from pydantic import BaseModel

from database.connection import get_db

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


# GET /api/ocrverify/verifiers - Verifiers list page data / verifiers list
@router.get("/verifiers")
async def verifiers(db: Session = Depends(get_db)):
    """List verifiers. CI: Users/index/verifiers."""
    return {"message": "Verifiers list", "data": []}


# GET /api/ocrverify/assignbatches - Assign batches page
@router.get("/assignbatches")
async def assignbatches(db: Session = Depends(get_db)):
    """Assign batches page. CI: ocrverify/Verifier/assignbatches."""
    return {"message": "Assign batches", "data": []}


# POST /api/ocrverify/assignbatches/ajaxlist - Batch assign DataTables list
@router.post("/assignbatches/ajaxlist")
async def batchassignajaxlist(
    request: DataTableRequest,
    db: Session = Depends(get_db),
):
    """Batch assign list. CI: batchassignajaxlist -> ocrverify/Verifier/batchassignajaxlist."""
    return {
        "draw": request.draw,
        "recordsTotal": 0,
        "recordsFiltered": 0,
        "data": [],
    }


# POST /api/ocrverify/assignbatches/save - Save assign batch data
@router.post("/assignbatches/save")
async def saveassignbatchdata(
    body: dict,
    db: Session = Depends(get_db),
):
    """Save assign batch. CI: saveassignbatchdata -> ocrverify/Verifier/saveassignbatchdata."""
    return {"success": True, "message": "Batch assignment saved"}


# POST /api/ocrverify/assignbatches/delete - Delete assigned batch
@router.post("/assignbatches/delete")
@router.delete("/assignbatches/delete")
async def delete_assgn_batch(
    body: Optional[dict] = None,
    db: Session = Depends(get_db),
):
    """Delete assigned batch. CI: deleteAssgnBatch -> ocrverify/Verifier/deleteAssgnBatch."""
    return {"success": True, "message": "Batch assignment deleted"}


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
