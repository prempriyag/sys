"""Skip Keywords Controller"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from database.connection import get_db
from models.skip_keywords_model import SkipKeywordsModel
from config.constants import TBL_SKIP_KEYWORDS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/skipkeywords", tags=["skipkeywords"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class SkipKeywordRequest(BaseModel):
    KEYWORD: str
    TO_DO: str = None
    FROM_TABLE_NAME: str = None
    FROM_COLUMN_NAME: str = None
    DISABLED_FLAG: str = None

class SkipKeywordUpdateRequest(BaseModel):
    Id: int
    KEYWORD: str
    TO_DO: str = None
    FROM_TABLE_NAME: str = None
    FROM_COLUMN_NAME: str = None
    DISABLED_FLAG: str = None

class DeleteRequest(BaseModel):
    id: int

@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(request: DataTableRequest, db: Session = Depends(get_db)):
    try:
        request_data = {
            "draw": request.draw,
            "start": request.start,
            "length": request.length,
            "search": request.search,
            "order": request.order,
            "columns": request.columns,
        }
        result = SkipKeywordsModel.get_skip_keywords_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Skip keywords ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: SkipKeywordRequest, db: Session = Depends(get_db)):
    try:
        insert_query = text(f"""
            INSERT INTO {TBL_SKIP_KEYWORDS} (KEYWORD, TO_DO, FROM_TABLE_NAME, FROM_COLUMN_NAME, DISABLED_FLAG)
            VALUES (:keyword, :to_do, :from_table_name, :from_column_name, :disabled_flag)
        """)
        db.execute(insert_query, {
            "keyword": request.KEYWORD.upper() if request.KEYWORD and request.KEYWORD.upper() != "NULL" else None,
            "to_do": request.TO_DO if request.TO_DO and request.TO_DO != "NULL" else None,
            "from_table_name": request.FROM_TABLE_NAME.upper() if request.FROM_TABLE_NAME and request.FROM_TABLE_NAME.upper() != "NULL" else None,
            "from_column_name": request.FROM_COLUMN_NAME.upper() if request.FROM_COLUMN_NAME and request.FROM_COLUMN_NAME.upper() != "NULL" else None,
            "disabled_flag": request.DISABLED_FLAG.upper() if request.DISABLED_FLAG and request.DISABLED_FLAG.upper() != "NULL" else None,
        })
        db.commit()
        return {"status": 1, "message": "Successfully added", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Skip keywords insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_skip(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_SKIP_KEYWORDS} WHERE SNO = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Skip keyword not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Skip keywords get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: SkipKeywordUpdateRequest, db: Session = Depends(get_db)):
    try:
        update_query = text(f"""
            UPDATE {TBL_SKIP_KEYWORDS}
            SET KEYWORD = :keyword, TO_DO = :to_do, FROM_TABLE_NAME = :from_table_name,
                FROM_COLUMN_NAME = :from_column_name, DISABLED_FLAG = :disabled_flag
            WHERE SNO = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "keyword": request.KEYWORD.upper() if request.KEYWORD and request.KEYWORD.upper() != "NULL" else None,
            "to_do": request.TO_DO if request.TO_DO and request.TO_DO != "NULL" else None,
            "from_table_name": request.FROM_TABLE_NAME.upper() if request.FROM_TABLE_NAME and request.FROM_TABLE_NAME.upper() != "NULL" else None,
            "from_column_name": request.FROM_COLUMN_NAME.upper() if request.FROM_COLUMN_NAME and request.FROM_COLUMN_NAME.upper() != "NULL" else None,
            "disabled_flag": request.DISABLED_FLAG.upper() if request.DISABLED_FLAG and request.DISABLED_FLAG.upper() != "NULL" else None,
        })
        db.commit()
        return {"status": 1, "message": "Successfully Updated", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Skip keywords update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_SKIP_KEYWORDS} WHERE SNO = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Skip keywords delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

