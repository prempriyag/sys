"""
Transcript Header OCR Model
Contains all query logic for Transcript Header OCR
Based on CI3 Transcripts_model.php gettranscripthdrocrdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_TRANSCRIPTHDROCR,
    COLLEGE_PROJECT_ID,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class TranscriptHdrOcrModel:
    """Model for Transcript Header OCR queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Transcripts_model.php gettranscripthdrocrdata() search logic exactly (lines 1440-1530)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 1441-1463)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( t.BATCH_ID like '%{search_safe}%' or
                lower(t.EXTERNAL_INSTITUTION_NAME) like '%{search_lower}%' or
                lower(t.STUDENT_FULL_NAME) like '%{search_lower}%' or 
                t.DATE_OF_BIRTH like '%{search_safe}%' or 
                lower(t.SSN) like '%{search_lower}%' or 
                lower(t.ADDRESS_LINE1) like '%{search_lower}%' or 
                lower(t.ADDRESS_LINE2) like '%{search_lower}%' or  
                lower(t.CITY) like '%{search_lower}%' or 
                lower(t.STATE) like '%{search_lower}%' or 
                t.ZIPCODE like '%{search_safe}%' or 
                lower(t.FILE_PATH) like '%{search_lower}%' or 
                t.OCR_UPLOADED_DATE like '%{search_safe}%' or
                t.CGPA like '%{search_safe}%' or
                t.DEGREE_RECEIVED_DATE like '%{search_safe}%' or
                t.TOTAL_CREDITS_EARNED like '%{search_safe}%' or
                lower(t.DEGREE) like '%{search_lower}%' or
                lower(t.STATUS_FLAG) like '%{search_lower}%' or
                t.TOTAL_CREDITS_ATTENDED like '%{search_safe}%')""")

        # Field-specific filters (matches CI3 lines 1466-1524)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "EXTERNAL_INSTITUTION_NAME" and field_name:
            search_conditions.append(f"t.EXTERNAL_INSTITUTION_NAME = '{check_special_name(field_name)}'")
        elif field_type == "STUDENT_FULL_NAME" and field_name:
            search_conditions.append(f"t.STUDENT_FULL_NAME like '%{check_special_name(field_name)}%'")
        elif field_type == "EXTERNAL_STUDENT_ID" and field_name:
            search_conditions.append(f"t.EXTERNAL_STUDENT_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "STATUS_SOAHSCH" and field_name:
            search_conditions.append(f"t.STATUS_SOAHSCH like '%{check_special_name(field_name)}%'")
        elif field_type == "BOT_PROCESSED_DATE" and field_name:
            search_conditions.append(f"t.BOT_PROCESSED_DATE like '%{check_special_name(field_name)}%'")
        elif field_type == "OCR_EXTRACTED_DATE" and field_name:
            search_conditions.append(f"t.OCR_UPLOADED_DATE like '%{check_special_name(field_name)}%'")
        elif field_type == "CITY" and field_name:
            search_conditions.append(f"t.CITY like '%{check_special_name(field_name)}%'")
        elif field_type == "STATE" and field_name:
            search_conditions.append(f"t.STATE like '%{check_special_name(field_name)}%'")
        elif field_type == "TRANSCRIPT_STATUS_FLAG" and field_name:
            search_conditions.append(f"t.STATUS_FLAG like '%{check_special_name(field_name)}%'")
        elif field_type == "BATCH_ID" and field_name:
            search_conditions.append(f"t.BATCH_ID like '%{check_special_name(field_name)}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "BATCH_ID": "t.BATCH_ID",
            "EXTERNAL_INSTITUTION_NAME": "t.EXTERNAL_INSTITUTION_NAME",
            "STUDENT_FULL_NAME": "t.STUDENT_FULL_NAME",
            "EXTERNAL_STUDENT_ID": "t.EXTERNAL_STUDENT_ID",
            "DATE_OF_BIRTH": "t.DATE_OF_BIRTH",
            "SSN": "t.SSN",
            "CITY": "t.CITY",
            "STATE": "t.STATE",
            "ZIPCODE": "t.ZIPCODE",
            "FILE_PATH": "t.FILE_PATH",
            "BOT_PROCESSED_DATE": "t.BOT_PROCESSED_DATE",
            "OCR_EXTRACTED_DATE": "t.OCR_EXTRACTED_DATE",
            "CGPA": "t.CGPA",
            "DEGREE_RECEIVED_DATE": "t.DEGREE_RECEIVED_DATE",
            "TOTAL_CREDITS_EARNED": "t.TOTAL_CREDITS_EARNED",
            "DEGREE": "t.DEGREE",
            "TOTAL_CREDITS_ATTENDED": "t.TOTAL_CREDITS_ATTENDED",
            "STATUS_FLAG": "t.STATUS_FLAG",
            "STATUS_SOAHSCH": "t.STATUS_SOAHSCH",
            "DUAL_DEGREE_FLAG": "t.DUAL_DEGREE_FLAG",
        }
        return column_mapping.get(column_name, "t.OCR_EXTRACTED_DATE")

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get Transcript Header OCR data for DataTables
        Matches CI3 Transcripts_model::gettranscripthdrocrdata() method (lines 1425-1604)
        """
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
            search_query = TranscriptHdrOcrModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = TranscriptHdrOcrModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 1532-1540)
            where_clauses = []
            if search_query:
                where_clauses.append(search_query)
            where_clauses.append(f"t.PROJECT_ID = {COLLEGE_PROJECT_ID}")
            
            where_clause = " AND ".join(where_clauses)
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_TRANSCRIPTHDROCR} as t WITH(NOLOCK)
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

            # Build data query (matches CI3 lines 1543-1551)
            # Select all columns
            data_query_sql = f"""
                SELECT t.*
                FROM {TBL_TRANSCRIPTHDROCR} as t WITH(NOLOCK)
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

            # Format data (matches CI3 lines 1555-1593)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")

                data_row = {
                    "BATCH_ID": batch_id,
                    "EXTERNAL_INSTITUTION_NAME": record_dict.get("EXTERNAL_INSTITUTION_NAME", ""),
                    "STUDENT_FULL_NAME": record_dict.get("STUDENT_FULL_NAME", ""),
                    "EXTERNAL_STUDENT_ID": record_dict.get("EXTERNAL_STUDENT_ID", ""),
                    "DATE_OF_BIRTH": str(record_dict.get("DATE_OF_BIRTH", "")) if record_dict.get("DATE_OF_BIRTH") else "",
                    "SSN": record_dict.get("SSN", ""),
                    "ADDRESS_LINE1": record_dict.get("ADDRESS_LINE1", ""),
                    "ADDRESS_LINE2": record_dict.get("ADDRESS_LINE2", ""),
                    "CITY": record_dict.get("CITY", ""),
                    "STATE": record_dict.get("STATE", ""),
                    "ZIPCODE": record_dict.get("ZIPCODE", ""),
                    "FILE_PATH": record_dict.get("FILE_PATH", ""),
                    "BOT_PROCESSED_DATE": str(record_dict.get("BOT_PROCESSED_DATE", "")) if record_dict.get("BOT_PROCESSED_DATE") else "",
                    "OCR_EXTRACTED_DATE": str(record_dict.get("OCR_EXTRACTED_DATE", "")) if record_dict.get("OCR_EXTRACTED_DATE") else "",
                    "CGPA": record_dict.get("CGPA", ""),
                    "DEGREE_RECEIVED_DATE": str(record_dict.get("DEGREE_RECEIVED_DATE", "")) if record_dict.get("DEGREE_RECEIVED_DATE") else "",
                    "TOTAL_CREDITS_EARNED": record_dict.get("TOTAL_CREDITS_EARNED", ""),
                    "DEGREE": record_dict.get("DEGREE", ""),
                    "TOTAL_CREDITS_ATTENDED": record_dict.get("TOTAL_CREDITS_ATTENDED", ""),
                    "STATUS_FLAG": record_dict.get("STATUS_FLAG", ""),
                    "STATUS_SOAHSCH": record_dict.get("STATUS_SOAHSCH", ""),
                    "DUAL_DEGREE_FLAG": record_dict.get("DUAL_DEGREE_FLAG", ""),
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

