"""
Transcript Header DATA Model
Contains all query logic for Transcript Header DATA
Based on CI3 Transcripts_model.php gettranscripthdrdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_TRANSCRIPTHDRDATA,
    TBL_INSTITUTION_MAPPING,
    COLLEGE_PROJECT_ID,
    SCHOOL_PROJECT_ID,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class TranscriptHdrDataModel:
    """Model for Transcript Header DATA queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Transcripts_model.php gettranscripthdrdata() search logic exactly (lines 1973-2067)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 1975-2014)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( t.BATCH_ID like '%{search_safe}%' or
                lower(t.STUDENT_ID) like '%{search_lower}%' or 
                lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = t.INSTITUTION_ID)) LIKE '%{search_lower}%' or
                lower(t.STUDENT_FULL_NAME) like '%{search_lower}%' or
                lower(t.STUDENT_FIRST_NAME) like '%{search_lower}%' or
                lower(t.STUDENT_MIDDLE_NAME) like '%{search_lower}%' or
                lower(t.STUDENT_LAST_NAME) like '%{search_lower}%' or 
                t.DATE_OF_BIRTH like '%{search_safe}%' or 
                t.SSN like '%{search_safe}%' or 
                lower(t.CITY) like '%{search_lower}%' or 
                lower(t.STATE) like '%{search_lower}%' or 
                t.ZIPCODE like '%{search_safe}%' or 
                lower(t.DEGREE_CD) like '%{search_lower}%' or
                lower(t.FOUND_IN_SLATE_YN) like '%{search_lower}%' or
                lower(t.FOUND_IN_BANNER_YN) like '%{search_lower}%' or
                t.STD_SLATE_TERM like '%{search_safe}%' or                
                t.OCR_MIN_START_TERM like '%{search_safe}%' or
                t.OCR_MAX_END_TERM like '%{search_safe}%' or
                t.EFFECTIVE_TERM like '%{search_safe}%' or
                lower(t.FILE_PATH) like '%{search_lower}%' or                  
                t.OCR_EXTRACTED_DATE like '%{search_safe}%' or
                t.CGPA like '%{search_safe}%' or
                t.DEGREE_RECEIVED_DATE like '%{search_safe}%' or
                t.TOTAL_CREDITS_EARNED like '%{search_safe}%' or
                lower(t.LEVEL) like '%{search_lower}%' or
                lower(t.COMMENTS) like '%{search_lower}%' or
                t.OCR_START_TERM_DT like '%{search_safe}%' or
                t.OCR_END_TERM_DT like '%{search_safe}%' or                
                lower(t.STATUS_FLAG) like '%{search_lower}%' or                
                t.TOTAL_CREDITS_ATTENDED like '%{search_safe}%')""")

        # Field-specific filters (matches CI3 lines 2017-2063)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "STATUS_SOAHSCH" and field_name:
            search_conditions.append(f"t.STATUS_SOAHSCH = '{check_special_name(field_name)}'")
        elif field_type == "CITY" and field_name:
            search_conditions.append(f"t.CITY = '{check_special_name(field_name)}'")
        elif field_type == "STATE" and field_name:
            search_conditions.append(f"t.STATE = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_FLAG" and field_name:
            search_conditions.append(f"t.STATUS_FLAG = '{check_special_name(field_name)}'")
        elif field_type == "BATCH_ID" and field_name:
            search_conditions.append(f"t.BATCH_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "STUDENT_ID" and field_name:
            search_conditions.append(f"t.STUDENT_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "STUDENT_FULL_NAME" and field_name:
            search_conditions.append(f"lower(t.STUDENT_FULL_NAME) like '%{check_special_name(field_name.lower())}%'")
        elif field_type == "EXTERNAL_INSTITUTION_NAME" and field_name:
            search_conditions.append(f"INSTITUTION_NAME like '%{check_special_name(field_name)}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "BATCH_ID": "t.BATCH_ID",
            "STUDENT_ID": "t.STUDENT_ID",
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = t.INSTITUTION_ID)",
            "STUDENT_FULL_NAME": "t.STUDENT_FULL_NAME",
            "STUDENT_FIRST_NAME": "t.STUDENT_FIRST_NAME",
            "STUDENT_LAST_NAME": "t.STUDENT_LAST_NAME",
            "STUDENT_MIDDLE_NAME": "t.STUDENT_MIDDLE_NAME",
            "DATE_OF_BIRTH": "t.DATE_OF_BIRTH",
            "SSN": "t.SSN",
            "CITY": "t.CITY",
            "STATE": "t.STATE",
            "ZIPCODE": "t.ZIPCODE",
            "DEGREE_CD": "t.DEGREE_CD",
            "DEGREE_RECEIVED_DATE": "t.DEGREE_RECEIVED_DATE",
            "CGPA": "t.CGPA",
            "TOTAL_CREDITS_EARNED": "t.TOTAL_CREDITS_EARNED",
            "TOTAL_CREDITS_ATTENDED": "t.TOTAL_CREDITS_ATTENDED",
            "FOUND_IN_SLATE_YN": "t.FOUND_IN_SLATE_YN",
            "FOUND_IN_BANNER_YN": "t.FOUND_IN_BANNER_YN",
            "STD_SLATE_TERM": "t.STD_SLATE_TERM",
            "OCR_MIN_START_TERM": "t.OCR_MIN_START_TERM",
            "OCR_MAX_END_TERM": "t.OCR_MAX_END_TERM",
            "EFFECTIVE_TERM": "t.EFFECTIVE_TERM",
            "LEVEL": "t.LEVEL",
            "COMMENTS": "t.COMMENTS",
            "STATUS_FLAG": "t.STATUS_FLAG",
            "FILE_PATH": "t.FILE_PATH",
            "OCR_EXTRACTED_DATE": "t.OCR_EXTRACTED_DATE",
            "OCR_START_TERM_DT": "t.OCR_START_TERM_DT",
            "OCR_END_TERM_DT": "t.OCR_END_TERM_DT",
        }
        return column_mapping.get(column_name, "t.OCR_EXTRACTED_DATE")

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
        project_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Get Transcript Header DATA for DataTables
        Matches CI3 Transcripts_model::gettranscripthdrdata() method (lines 1958-2157)
        project_id: COLLEGE_PROJECT_ID or SCHOOL_PROJECT_ID; default COLLEGE_PROJECT_ID.
        """
        pid = project_id if project_id is not None else COLLEGE_PROJECT_ID
        try:
            # Extract request parameters
            draw = int(request_data.get("draw", 1))
            start = int(request_data.get("start", 0))
            length = int(request_data.get("length", 10))
            
            order = request_data.get("order", [{}])
            if order and len(order) > 0:
                column_index = int(order[0].get("column", 0))
                column_dir = order[0].get("dir", "asc")
            else:
                column_index = 0
                column_dir = "asc"

            columns = request_data.get("columns", [])
            if columns and len(columns) > column_index:
                column_name = columns[column_index].get("data", "OCR_EXTRACTED_DATE")
            else:
                column_name = "OCR_EXTRACTED_DATE"

            # Build search conditions
            search_query = TranscriptHdrDataModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = TranscriptHdrDataModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 2069-2078)
            where_clauses = []
            if search_query:
                where_clauses.append(search_query)
            where_clauses.append(f"t.PROJECT_ID = {pid}")
            
            where_clause = " AND ".join(where_clauses)
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_TRANSCRIPTHDRDATA} as t WITH(NOLOCK)
                WHERE {where_clause}
            """)

            try:
                count_result = db.execute(count_query).fetchone()
                if count_result:
                    try:
                        total_records = count_result.allcount
                    except AttributeError:
                        total_records = count_result[0] if count_result else 0
                else:
                    total_records = 0
                records_filtered = total_records
            except Exception as e:
                logger.error(f"Error executing count query: {e}")
                raise

            # Build data query (matches CI3 lines 2080-2090)
            data_query_sql = f"""
                SELECT t.*,(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = t.INSTITUTION_ID) AS INSTITUTION_NAME
                FROM {TBL_TRANSCRIPTHDRDATA} as t WITH(NOLOCK)
                WHERE {where_clause}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            data_query = text(data_query_sql)

            try:
                records = db.execute(data_query).fetchall()
            except Exception as e:
                logger.error(f"Error executing data query: {e}")
                raise

            # Format data (matches CI3 lines 2094-2147)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")

                data_row = {
                    "BATCH_ID": batch_id,
                    "STUDENT_ID": student_id,
                    "INSTITUTION_NAME": record_dict.get("INSTITUTION_NAME", ""),
                    "STUDENT_FULL_NAME": record_dict.get("STUDENT_FULL_NAME", ""),
                    "STUDENT_FIRST_NAME": record_dict.get("STUDENT_FIRST_NAME", ""),
                    "STUDENT_LAST_NAME": record_dict.get("STUDENT_LAST_NAME", ""),
                    "STUDENT_MIDDLE_NAME": record_dict.get("STUDENT_MIDDLE_NAME", ""),
                    "DATE_OF_BIRTH": str(record_dict.get("DATE_OF_BIRTH", "")) if record_dict.get("DATE_OF_BIRTH") else "",
                    "SSN": record_dict.get("SSN", ""),
                    "ADDRESS_LINE1": record_dict.get("ADDRESS_LINE1", ""),
                    "ADDRESS_LINE2": record_dict.get("ADDRESS_LINE2", ""),
                    "CITY": record_dict.get("CITY", ""),
                    "STATE": record_dict.get("STATE", ""),
                    "ZIPCODE": record_dict.get("ZIPCODE", ""),
                    "DEGREE_CD": record_dict.get("DEGREE_CD", ""),
                    "DEGREE_RECEIVED_DATE": str(record_dict.get("DEGREE_RECEIVED_DATE", "")) if record_dict.get("DEGREE_RECEIVED_DATE") else "",
                    "CGPA": record_dict.get("CGPA", ""),
                    "TOTAL_CREDITS_EARNED": record_dict.get("TOTAL_CREDITS_EARNED", ""),
                    "TOTAL_CREDITS_ATTENDED": record_dict.get("TOTAL_CREDITS_ATTENDED", ""),
                    "FOUND_IN_SLATE_YN": record_dict.get("FOUND_IN_SLATE_YN", ""),
                    "FOUND_IN_BANNER_YN": record_dict.get("FOUND_IN_BANNER_YN", ""),
                    "STD_SLATE_TERM": record_dict.get("STD_SLATE_TERM", ""),
                    "OCR_MIN_START_TERM": record_dict.get("OCR_MIN_START_TERM", ""),
                    "OCR_MAX_END_TERM": record_dict.get("OCR_MAX_END_TERM", ""),
                    "EFFECTIVE_TERM": record_dict.get("EFFECTIVE_TERM", ""),
                    "LEVEL": record_dict.get("LEVEL", ""),
                    "COMMENTS": record_dict.get("COMMENTS", ""),
                    "STATUS_FLAG": record_dict.get("STATUS_FLAG", ""),
                    "FILE_PATH": record_dict.get("FILE_PATH", ""),
                    "OCR_EXTRACTED_DATE": str(record_dict.get("OCR_EXTRACTED_DATE", "")) if record_dict.get("OCR_EXTRACTED_DATE") else "",
                    "OCR_START_TERM_DT": str(record_dict.get("OCR_START_TERM_DT", "")) if record_dict.get("OCR_START_TERM_DT") else "",
                    "OCR_END_TERM_DT": str(record_dict.get("OCR_END_TERM_DT", "")) if record_dict.get("OCR_END_TERM_DT") else "",
                    # Metadata for frontend rendering
                    "_has_update_permission": has_update_permission,
                }

                data.append(data_row)

            # Return DataTables response
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }

        except Exception as e:
            logger.error(f"Error in get_reports_data: {e}")
            raise



