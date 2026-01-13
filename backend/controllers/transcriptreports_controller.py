"""
Transcript Reports Controller
Based on CI3 Transcriptreports controller
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_, and_
from typing import Optional
from pydantic import BaseModel
import logging
from database.connection import get_db
from helpers.security_helper import require_permission, get_current_user
from models import User
from config.constants import TBL_KICKOUT, TBL_TRANSCRIPTHDRDATA, TBL_DOWNLOAD, TBL_INSTITUTION_MAPPING, COLLEGE_PROJECT_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcriptreports", tags=["transcriptreports"])


class DataTableRequest(BaseModel):
    """DataTables request model"""
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


@router.post("/ajaxlist", response_model=dict)
async def ajaxlist(
    request: DataTableRequest,
    current_user: User = Depends(require_permission('college_digiscript_reports', 'VIEW')),
    db: Session = Depends(get_db)
):
    """
    Get transcript reports list (DataTables)
    Based on ajaxlist() method from Transcriptreports.php
    """
    try:
        draw = request.draw
        start = request.start
        rowperpage = request.length
        column_index = request.order[0]['column'] if request.order else 0
        column_name = request.columns[column_index]['data'] if request.columns else 'LAST_UPDATED_DATETIME'
        column_sort_order = request.order[0]['dir'] if request.order else 'desc'
        search_value = request.search.get('value', '')
        
        logger.info(f"Transcript reports request - draw: {draw}, start: {start}, length: {rowperpage}, Search_Field: {request.Search_Field}")
        
        # Build search conditions (using parameterized queries for safety)
        search_conditions = []
        query_params = {"project_id": COLLEGE_PROJECT_ID}
        
        # Global search
        if search_value:
        search_value_lower = search_value.lower()
        search_conditions.append("""(
            k.BATCH_ID LIKE :search_value OR
            k.INSTITUTION_ID LIKE :search_value OR
            LOWER(d.SOURCE_TYPE) LIKE :search_value_lower OR
            LOWER(k.STUDENT_ID) LIKE :search_value_lower OR
            LOWER(k.STUDENT_FULL_NAME) LIKE :search_value_lower OR
            LOWER(k.STATUS_SLATE) LIKE :search_value_lower OR
            LOWER(k.SLATE_REF_NUMBER) LIKE :search_value_lower OR
            LOWER(k.STATUS_SLATE_UPLOAD) LIKE :search_value_lower OR
            LOWER(k.STATUS_BDMS) LIKE :search_value_lower OR
            LOWER(k.ERROR_REASON) LIKE :search_value_lower OR
            LOWER(k.USER_COMMENTS) LIKE :search_value_lower OR
            LOWER(k.TRANSCRIPT_STATUS_FLAG) LIKE :search_value_lower OR
            LOWER(k.ARTICULATION_STATUS_FLAG) LIKE :search_value_lower OR
            k.LAST_UPDATED_DATETIME LIKE :search_value OR
            LOWER(k.UPDATED_BY) LIKE :search_value_lower
        )""")
            query_params["search_value"] = f"%{search_value}%"
            query_params["search_value_lower"] = f"%{search_value_lower}%"
        
        # Search_Field filter (type filter)
        if request.Search_Field == 'Processed':
            search_conditions.append("(UPPER(k.TRANSCRIPT_STATUS_FLAG) LIKE 'PROCESSED' OR UPPER(k.TRANSCRIPT_STATUS_FLAG) LIKE 'PROCESSED MANUALLY BY OSU-OKC' OR UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'DUPLICATE' OR UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'NO ACTION NEEDED')")
        elif request.Search_Field == 'Failed':
            search_conditions.append("UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'FAILED'")
        elif request.Search_Field == 'Rerun':
            search_conditions.append("(UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'RERUN' OR UPPER(k.ARTICULATION_STATUS_FLAG) = 'RERUN')")
        elif request.Search_Field == 'equivalenthours':
            search_conditions.append("(UPPER(k.ERROR_REASON) LIKE '%EQUIVALENT ROLL HOURS DO NOT MATCH. PLEASE REVIEW%' AND UPPER(k.ARTICULATION_STATUS_FLAG) = 'PROCESSED' AND k.UPDATED_BY = 'Articulation BOT')")
        elif request.Search_Field == 'Articulation-Kickouts':
            search_conditions.append("(UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'PROCESSED' AND (UPPER(k.ARTICULATION_STATUS_FLAG) = 'FAILED' OR UPPER(k.ARTICULATION_STATUS_FLAG) = 'PARTIALLY PROCESSED'))")
        
        # Field type filters
        if request.fieldType and request.fieldName:
            param_key = f"field_{len(query_params)}"
            if request.fieldType == 'BATCH_ID':
                search_conditions.append(f"k.BATCH_ID LIKE :{param_key}")
                query_params[param_key] = f"%{request.fieldName}%"
            elif request.fieldType == 'COLLEGE_ID':
                search_conditions.append(f"k.INSTITUTION_ID = :{param_key}")
                query_params[param_key] = request.fieldName
            elif request.fieldType == 'STUDENT_ID':
                search_conditions.append(f"UPPER(k.STUDENT_ID) LIKE :{param_key}")
                query_params[param_key] = f"%{request.fieldName.upper()}%"
            elif request.fieldType == 'STUDENT_FULL_NAME':
                search_conditions.append(f"UPPER(k.STUDENT_FULL_NAME) LIKE :{param_key}")
                query_params[param_key] = f"%{request.fieldName.upper()}%"
            elif request.fieldType == 'ERROR_REASON':
                search_conditions.append(f"LOWER(k.ERROR_REASON) LIKE :{param_key}")
                query_params[param_key] = f"%{request.fieldName.lower()}%"
            elif request.fieldType == 'TRANSCRIPT_STATUS_FLAG':
                search_conditions.append(f"k.TRANSCRIPT_STATUS_FLAG = :{param_key}")
                query_params[param_key] = request.fieldName
            elif request.fieldType == 'ARTICULATION_STATUS_FLAG':
                search_conditions.append(f"k.ARTICULATION_STATUS_FLAG = :{param_key}")
                query_params[param_key] = request.fieldName
            elif request.fieldType == 'UPDATED_BY':
                if request.fieldName == 'others':
                    search_conditions.append("k.UPDATED_BY != 'Transcript BOT' AND k.UPDATED_BY != 'Articulation BOT'")
                else:
                    search_conditions.append(f"k.UPDATED_BY = :{param_key}")
                    query_params[param_key] = request.fieldName
            elif request.fieldType == 'UPDATED_DATE' and request.fromDate and request.toDate:
                search_conditions.append(f"CAST(k.LAST_UPDATED_DATETIME AS DATE) BETWEEN :from_date AND :to_date")
                query_params["from_date"] = request.fromDate
                query_params["to_date"] = request.toDate
        
        # Additional filters
        if request.STUDENT_ID:
            param_key = f"student_id_{len(query_params)}"
            search_conditions.append(f"(k.STUDENT_ID LIKE :{param_key} OR LOWER(k.STUDENT_FULL_NAME) LIKE :{param_key}_lower)")
            query_params[param_key] = f"%{request.STUDENT_ID}%"
            query_params[f"{param_key}_lower"] = f"%{request.STUDENT_ID.lower()}%"
        
        if request.BATCH_ID:
            param_key = f"batch_id_{len(query_params)}"
            search_conditions.append(f"k.BATCH_ID LIKE :{param_key}")
            query_params[param_key] = f"%{request.BATCH_ID}%"
        
        # Build WHERE clause
        where_clause = ""
        if search_conditions:
            where_clause = " AND " + " AND ".join(search_conditions)
        
        # Count total records - simplified query for better performance
        count_sql = f"""
            SELECT COUNT(*) as allcount
            FROM {TBL_KICKOUT} k WITH(NOLOCK)
            INNER JOIN {TBL_TRANSCRIPTHDRDATA} h WITH(NOLOCK) ON h.BATCH_ID = k.BATCH_ID
            INNER JOIN {TBL_DOWNLOAD} d WITH(NOLOCK) ON d.BATCH_ID = k.BATCH_ID
            WHERE k.PROJECT_ID = :project_id
        """
        
        if where_clause:
            count_sql += where_clause
        
        logger.debug(f"Count query: {count_sql[:200]}...")
        count_query = text(count_sql)
        
        try:
            count_result = db.execute(count_query, query_params).fetchone()
            total_records = count_result.allcount if count_result else 0
            total_recordswith_filter = total_records
            logger.info(f"Total records found: {total_records}")
        except Exception as e:
            logger.error(f"Error executing count query: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        # Fetch records
        # Map column names to actual database columns for sorting
        order_column_map = {
            'INSTITUTION_NAME': f'(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)',
            'INSTITUTION_ID': 'k.INSTITUTION_ID',
            'STUDENT_ID': 'k.STUDENT_ID',
            'SLATE_REF_NUMBER': 'k.SLATE_REF_NUMBER',
            'STUDENT_FULL_NAME': 'k.STUDENT_FULL_NAME',
            'BATCH_ID': 'k.BATCH_ID',
            'STATUS_SLATE': 'k.STATUS_SLATE',
            'STATUS_SLATE_UPLOAD': 'k.STATUS_SLATE_UPLOAD',
            'STATUS_BANNER': 'k.STATUS_SOAPCOL',
            'STATUS_BDMS': 'k.STATUS_BDMS',
            'TRANSCRIPT_STATUS_FLAG': 'k.TRANSCRIPT_STATUS_FLAG',
            'ARTICULATION_STATUS_FLAG': 'k.ARTICULATION_STATUS_FLAG',
            'ERROR_REASON': 'k.ERROR_REASON',
            'LAST_UPDATED_DATETIME': 'k.LAST_UPDATED_DATETIME',
            'UPDATED_BY': 'k.UPDATED_BY',
        'PROCESS_STATUS': 'k.PROCESS_STATUS',
        }
        
        order_by = order_column_map.get(column_name, 'k.LAST_UPDATED_DATETIME')
        
        # Build data query - use simpler approach for SQL Server
        # Note: We'll use TOP with a calculated number instead of OFFSET/FETCH for better compatibility
        limit_value = start + rowperpage
        
        data_sql = f"""
            SELECT TOP ({limit_value})
                k.BATCH_ID,
                k.INSTITUTION_ID,
                k.LETTER_SENT_DATE,
                k.TRANSFER_LETTER_FILE_LINK,
                k.STUDENT_ID,
                k.SLATE_PROSPECT_ID,
                k.SLATE_REF_NUMBER,
                k.STUDENT_FULL_NAME,
                k.STATUS_SAAADMS,
                k.STATUS_SOAPCOL,
                k.STATUS_BDMS,
                k.STATUS_SLATE,
                k.STATUS_SLATE_UPLOAD,
                k.STATUS_SHATAEQ,
                k.STATUS_SPACMNT,
                k.SCENARIO,
                k.COMMENTS,
                k.ERROR_REASON,
                k.ERROR_SCREENSHOT,
                k.TRANSCRIPT_LINK,
                k.TRANSCRIPT_STATUS_FLAG,
                k.ARTICULATION_STATUS_FLAG,
                k.STATUS_SOAHSCH,
                k.STATUS_SOAHOLD,
                k.LAST_UPDATED_DATETIME,
                k.UPDATED_BY,
                k.USER_COMMENTS,
                k.PROCESS_STATUS,
                h.STATE,
                h.CITY,
                h.ZIPCODE,
                d.SOURCE_TYPE,
                h.DATE_OF_BIRTH,
                h.SSN,
                h.STUDENT_FIRST_NAME,
                h.STUDENT_LAST_NAME,
                h.CGPA,
                h.TOTAL_CREDITS_EARNED,
                h.TOTAL_CREDITS_ATTENDED,
                h.DEGREE_CD,
                h.DEGREE_RECEIVED_DATE,
                h.SECOND_DEGREE_CD,
                h.SECOND_DEGREE_RECEIVED_DATE,
                h.EXTERNAL_INSTITUTION_ZIPCODE,
                (SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID) AS INSTITUTION_NAME
            FROM {TBL_KICKOUT} k WITH(NOLOCK)
            INNER JOIN {TBL_TRANSCRIPTHDRDATA} h WITH(NOLOCK) ON h.BATCH_ID = k.BATCH_ID
            INNER JOIN {TBL_DOWNLOAD} d WITH(NOLOCK) ON d.BATCH_ID = k.BATCH_ID
            WHERE k.PROJECT_ID = :project_id
        """
        
        if where_clause:
            data_sql += where_clause
        
        data_sql += f" ORDER BY {order_by} {column_sort_order.upper()}"
        
        # Use ROW_NUMBER for pagination (more reliable with SQL Server)
        if start > 0:
            # Wrap in subquery to use ROW_NUMBER for pagination
            inner_sql = data_sql.replace(f'SELECT TOP ({limit_value})', 'SELECT')
            data_sql = f"""
                SELECT * FROM (
                    SELECT ROW_NUMBER() OVER (ORDER BY {order_by} {column_sort_order.upper()}) AS RowNum, *
                    FROM ({inner_sql}) AS SubQuery
                ) AS NumberedRows
                WHERE RowNum > {start} AND RowNum <= {limit_value}
            """
        
        logger.debug(f"Data query: {data_sql[:300]}...")
        data_query = text(data_sql)
        
        try:
            records = db.execute(data_query, query_params).fetchall()
            logger.info(f"Fetched {len(records)} records")
        except Exception as e:
            logger.error(f"Error executing data query: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        
        # Format data for DataTables
        data = []
        for record in records:
            # Format transcript link (simplified - actual implementation would need file path logic)
            transcript_link = record.TRANSCRIPT_LINK if record.TRANSCRIPT_LINK else ''
            
            # Format error screenshot (simplified)
            error_screenshot = record.ERROR_SCREENSHOT if record.ERROR_SCREENSHOT else ''
            
            # Format action column (simplified - actual implementation would need permission checks)
            action = ''
            
            data.append({
            "INSTITUTION_NAME": record.INSTITUTION_NAME or '',
            "INSTITUTION_ID": record.INSTITUTION_ID or '',
            "EXTERNAL_INSTITUTION_ZIPCODE": record.EXTERNAL_INSTITUTION_ZIPCODE or '',
            "STUDENT_ID": record.STUDENT_ID or '',
            "SLATE_REF_NUMBER": record.SLATE_REF_NUMBER or '',
            "STUDENT_FULL_NAME": record.STUDENT_FULL_NAME or '',
            "STUDENT_FIRST_NAME": record.STUDENT_FIRST_NAME or '',
            "STUDENT_LAST_NAME": record.STUDENT_LAST_NAME or '',
            "DATE_OF_BIRTH": str(record.DATE_OF_BIRTH) if record.DATE_OF_BIRTH else '',
            "SSN": record.SSN or '',
            "BATCH_ID": record.BATCH_ID or '',
            "CGPA": str(record.CGPA) if record.CGPA else '',
            "TOTAL_CREDITS_EARNED": str(record.TOTAL_CREDITS_EARNED) if record.TOTAL_CREDITS_EARNED else '',
            "TOTAL_CREDITS_ATTENDED": str(record.TOTAL_CREDITS_ATTENDED) if record.TOTAL_CREDITS_ATTENDED else '',
            "DEGREE_CD": record.DEGREE_CD or '',
            "DEGREE_RECEIVED_DATE": str(record.DEGREE_RECEIVED_DATE) if record.DEGREE_RECEIVED_DATE else '',
            "SECOND_DEGREE_CD": record.SECOND_DEGREE_CD or '',
            "SECOND_DEGREE_RECEIVED_DATE": str(record.SECOND_DEGREE_RECEIVED_DATE) if record.SECOND_DEGREE_RECEIVED_DATE else '',
            "STATUS_SLATE": record.STATUS_SLATE or '',
            "STATUS_SLATE_UPLOAD": record.STATUS_SLATE_UPLOAD or '',
            "STATUS_BANNER": record.STATUS_SOAPCOL or '',
            "STATUS_BDMS": record.STATUS_BDMS or '',
            "SCENARIO": record.SCENARIO or '',
            "COMMENTS": record.COMMENTS or '',
            "ERROR_REASON": record.ERROR_REASON or '',
            "ERROR_SCREENSHOT": error_screenshot,
            "TRANSCRIPT_LINK": transcript_link,
            "SOURCE_TYPE": record.SOURCE_TYPE or '',
            "TRANSCRIPT_STATUS_FLAG": record.TRANSCRIPT_STATUS_FLAG or '',
            "ARTICULATION_STATUS_FLAG": record.ARTICULATION_STATUS_FLAG or '',
            "ACTION": action,
            "LETTER_SENT_DATE": str(record.LETTER_SENT_DATE) if record.LETTER_SENT_DATE else '',
            "TRANSFER_LETTER_FILE_LINK": record.TRANSFER_LETTER_FILE_LINK or '',
            "USER_COMMENTS": record.USER_COMMENTS or '',
            "LAST_UPDATED_DATETIME": str(record.LAST_UPDATED_DATETIME) if record.LAST_UPDATED_DATETIME else '',
            "UPDATED_BY": record.UPDATED_BY or '',
            "PROCESS_STATUS": record.PROCESS_STATUS or '',
            })
        
        return {
            "draw": draw,
            "recordsTotal": total_records,
            "recordsFiltered": total_recordswith_filter,
            "data": data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in ajaxlist: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

