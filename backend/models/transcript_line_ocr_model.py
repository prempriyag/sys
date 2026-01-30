"""
Transcript Line OCR Model
Contains all query logic for Transcript Line OCR
Based on CI3 Transcripts_model.php gettranscriptlineocrdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_TRANSCRIPTLINEOCR,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class TranscriptLineOcrModel:
    """Model for Transcript Line OCR queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Transcripts_model.php gettranscriptlineocrdata() search logic exactly (lines 1765-1813)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 1767-1779)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( BATCH_ID like '%{search_safe}%' or
                lower(START_TERM) like '%{search_lower}%' or
                COURSE_ID like '%{search_safe}%' or 
                COURSE_TITLE like '%{search_safe}%' or 
                lower(END_TERM) like '%{search_lower}%' or 
                CREDIT_HOURS_EARNED like '%{search_safe}%' or 
                PAGE_NBR like '%{search_safe}%' or 
                lower(SUBJECT) like '%{search_lower}%' or 
                lower(GRADE) like '%{search_lower}%' or  
                lower(STATUS_FLAG) like '%{search_lower}%' or 
                lower(AUTO_SEQNO) like '%{search_lower}%')""")

        # Field-specific filters (matches CI3 lines 1781-1809)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "START_TERM" and field_name:
            search_conditions.append(f"START_TERM = '{check_special_name(field_name)}'")
        elif field_type == "END_TERM" and field_name:
            search_conditions.append(f"END_TERM like '%{check_special_name(field_name)}%'")
        elif field_type == "SUBJECT" and field_name:
            search_conditions.append(f"SUBJECT like '%{check_special_name(field_name)}%'")
        elif field_type == "STATUS_FLAG" and field_name:
            search_conditions.append(f"STATUS_FLAG like '%{check_special_name(field_name)}%'")
        elif field_type == "BATCH_ID" and field_name:
            search_conditions.append(f"BATCH_ID like '%{check_special_name(field_name)}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "BATCH_ID": "BATCH_ID",
            "START_TERM": "START_TERM",
            "END_TERM": "END_TERM",
            "SUBJECT": "SUBJECT",
            "COURSE_ID": "COURSE_ID",
            "COURSE_TITLE": "COURSE_TITLE",
            "CREDIT_HOURS_EARNED": "CREDIT_HOURS_EARNED",
            "GRADE": "GRADE",
            "STATUS_FLAG": "STATUS_FLAG",
            "PAGE_NBR": "PAGE_NBR",
            "AUTO_SEQNO": "AUTO_SEQNO",
        }
        return column_mapping.get(column_name, "BATCH_ID")

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get Transcript Line OCR data for DataTables
        Matches CI3 Transcripts_model::gettranscriptlineocrdata() method (lines 1750-1877)
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
                column_name = columns[column_index].get("data", "BATCH_ID")
            else:
                column_name = "BATCH_ID"

            # Build search conditions
            search_query = TranscriptLineOcrModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = TranscriptLineOcrModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 1824-1831)
            where_clause = search_query if search_query else "1=1"
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_TRANSCRIPTLINEOCR} WITH(NOLOCK)
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

            # Build data query (matches CI3 lines 1834-1842)
            data_query_sql = f"""
                SELECT *
                FROM {TBL_TRANSCRIPTLINEOCR} WITH(NOLOCK)
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

            # Format data (matches CI3 lines 1846-1866)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")

                data_row = {
                    "BATCH_ID": batch_id,
                    "START_TERM": record_dict.get("START_TERM", ""),
                    "END_TERM": record_dict.get("END_TERM", ""),
                    "SUBJECT": record_dict.get("SUBJECT", ""),
                    "COURSE_ID": record_dict.get("COURSE_ID", ""),
                    "COURSE_TITLE": record_dict.get("COURSE_TITLE", ""),
                    "CREDIT_HOURS_EARNED": record_dict.get("CREDIT_HOURS_EARNED", ""),
                    "GRADE": record_dict.get("GRADE", ""),
                    "STATUS_FLAG": record_dict.get("STATUS_FLAG", ""),
                    "PAGE_NBR": record_dict.get("PAGE_NBR", ""),
                    "AUTO_SEQNO": record_dict.get("AUTO_SEQNO", ""),
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



