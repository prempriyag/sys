"""Bot Schedule Controller"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
import logging
from datetime import datetime
from database.connection import get_db
from helpers.security_helper import get_username_from_token
from models.bot_schedule_model import BotScheduleModel
from config.constants import TBL_BOT_SCHEDULE

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/botschedule", tags=["botschedule"])

class DataTableRequest(BaseModel):
    draw: int
    start: int
    length: int
    search: dict
    order: list
    columns: list

class BotScheduleRequest(BaseModel):
    PROJECT: str
    BOTNAME: str
    STARTIST: str
    AVERAGETIME: str
    FREQUENCY: str
    FINISHFIRSTRUN: str
    SERVERIP: str
    USERNAME: str

class BotScheduleUpdateRequest(BaseModel):
    Id: int
    PROJECT: str
    BOTNAME: str
    STARTIST: str
    AVERAGETIME: str
    FREQUENCY: str
    FINISHFIRSTRUN: str
    SERVERIP: str
    USERNAME: str

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
        result = BotScheduleModel.get_bot_schedule_data(db=db, request_data=request_data)
        return result
    except Exception as e:
        logger.exception("Bot schedule ajaxlist error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/insert", response_model=dict)
async def insert(request: BotScheduleRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_BOT_SCHEDULE}
            WHERE lower(PROJECT) = lower(:project) AND lower(BOTNAME) = lower(:botname)
            AND STARTIST = :startist AND AVERAGETIME = :averagetime
            AND lower(FREQUENCY) = lower(:frequency) AND FINISHFIRSTRUN = :finishfirstrun
            AND SERVERIP = :serverip AND lower(USERNAME) = lower(:username)
        """)
        check_result = db.execute(check_query, {
            "project": request.PROJECT.strip().lower(),
            "botname": request.BOTNAME.strip().lower(),
            "startist": request.STARTIST.strip(),
            "averagetime": request.AVERAGETIME.strip(),
            "frequency": request.FREQUENCY.strip().lower(),
            "finishfirstrun": request.FINISHFIRSTRUN.strip(),
            "serverip": request.SERVERIP.strip(),
            "username": request.USERNAME.strip().lower()
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        insert_query = text(f"""
            INSERT INTO {TBL_BOT_SCHEDULE} (PROJECT, BOTNAME, STARTIST, AVERAGETIME, FREQUENCY, FINISHFIRSTRUN, SERVERIP, USERNAME, CREATEDBY, UPDATEDBY, CREATEDON, UPDATEDON)
            VALUES (:project, :botname, :startist, :averagetime, :frequency, :finishfirstrun, :serverip, :username, :createdby, :updatedby, :createdon, :updatedon)
        """)
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        db.execute(insert_query, {
            "project": request.PROJECT.strip(),
            "botname": request.BOTNAME.strip(),
            "startist": request.STARTIST.strip(),
            "averagetime": request.AVERAGETIME.strip(),
            "frequency": request.FREQUENCY.strip(),
            "finishfirstrun": request.FINISHFIRSTRUN.strip(),
            "serverip": request.SERVERIP.strip(),
            "username": request.USERNAME.strip(),
            "createdby": get_username_from_token(http_request),
            "updatedby": get_username_from_token(http_request),
            "createdon": now,
            "updatedon": now
        })
        db.commit()
        return {"status": 1, "message": "Successfully added.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Bot schedule insert error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/get", response_model=dict)
async def get_bot(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        query = text(f"SELECT * FROM {TBL_BOT_SCHEDULE} WHERE Id = :id")
        result = db.execute(query, {"id": request.id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Bot schedule not found")
        return dict(result._mapping)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Bot schedule get error")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/update", response_model=dict)
async def update(request: BotScheduleUpdateRequest, http_request: Request, db: Session = Depends(get_db)):
    try:
        check_query = text(f"""
            SELECT COUNT(*) as count FROM {TBL_BOT_SCHEDULE}
            WHERE lower(PROJECT) = lower(:project) AND lower(BOTNAME) = lower(:botname)
            AND STARTIST = :startist AND AVERAGETIME = :averagetime
            AND lower(FREQUENCY) = lower(:frequency) AND FINISHFIRSTRUN = :finishfirstrun
            AND SERVERIP = :serverip AND lower(USERNAME) = lower(:username) AND Id <> :id
        """)
        check_result = db.execute(check_query, {
            "project": request.PROJECT.strip().lower(),
            "botname": request.BOTNAME.strip().lower(),
            "startist": request.STARTIST.strip(),
            "averagetime": request.AVERAGETIME.strip(),
            "frequency": request.FREQUENCY.strip().lower(),
            "finishfirstrun": request.FINISHFIRSTRUN.strip(),
            "serverip": request.SERVERIP.strip(),
            "username": request.USERNAME.strip().lower(),
            "id": request.Id
        }).fetchone()
        if check_result and (check_result.count if hasattr(check_result, 'count') else check_result[0]) > 0:
            return {"status": 0, "message": "Duplicate Data found.", "refresh": False, "modal_close": True}
        update_query = text(f"""
            UPDATE {TBL_BOT_SCHEDULE}
            SET PROJECT = :project, BOTNAME = :botname, STARTIST = :startist, AVERAGETIME = :averagetime,
                FREQUENCY = :frequency, FINISHFIRSTRUN = :finishfirstrun, SERVERIP = :serverip,
                USERNAME = :username, UPDATEDBY = :updatedby, UPDATEDON = :updatedon
            WHERE Id = :id
        """)
        result = db.execute(update_query, {
            "id": request.Id,
            "project": request.PROJECT.strip(),
            "botname": request.BOTNAME.strip(),
            "startist": request.STARTIST.strip(),
            "averagetime": request.AVERAGETIME.strip(),
            "frequency": request.FREQUENCY.strip(),
            "finishfirstrun": request.FINISHFIRSTRUN.strip(),
            "serverip": request.SERVERIP.strip(),
            "username": request.USERNAME.strip(),
            "updatedby": get_username_from_token(http_request),
            "updatedon": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })
        db.commit()
        return {"status": 1, "message": "Successfully updated.", "refresh": False, "modal_close": True} if result.rowcount > 0 else {"status": 0, "message": "Sorry record not updated please try again.", "refresh": False, "modal_close": True}
    except Exception as e:
        logger.exception("Bot schedule update error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@router.post("/delete", response_model=dict)
async def delete(request: DeleteRequest, db: Session = Depends(get_db)):
    try:
        delete_query = text(f"DELETE FROM {TBL_BOT_SCHEDULE} WHERE Id = :id")
        result = db.execute(delete_query, {"id": request.id})
        db.commit()
        return {"status": "Success"} if result.rowcount > 0 else {"status": "Error"}
    except Exception as e:
        logger.exception("Bot schedule delete error")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")



