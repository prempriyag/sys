"""
Transcript Line DATA Model
Contains all query logic for Transcript Line DATA
Based on CI3 Transcripts_model.php gettranscriptlinedata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_TRANSCRIPTLINEDATA,
    TBL_TRANSCRIPTHDRDATA,
    COLLEGE_PROJECT_ID,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class TranscriptLineDataModel:
    """Model for Transcript Line DATA queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Transcripts_model.php gettranscriptlinedata() search logic exactly (lines 2174-2237)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 2177-2196)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""(d.BATCH_ID like '%{search_safe}%' or
                lower(d.STUDENT_ID) like '%{search_lower}%' or
                lower(d.SUBJECT) like '%{search_lower}%' or
                lower(d.COURSE_ID) like '%{search_lower}%' or
                lower(d.COURSE_TITLE) like '%{search_lower}%' or
                d.PERM_APPROVED like '%{search_safe}%' or
                lower(d.COMMENTS) like '%{search_lower}%' or
                lower(d.START_TERM_NAME) like '%{search_lower}%' or
                lower(d.START_TERM) like '%{search_lower}%' or
                lower(d.END_TERM_NAME) like '%{search_lower}%' or
                lower(d.START_TERM_YEAR) like '%{search_lower}%' or
                lower(d.END_TERM_YEAR) like '%{search_lower}%' or 
                lower(d.END_TERM) like '%{search_lower}%' or 
                d.CREDIT_HOURS_EARNED like '%{search_safe}%' or 
                d.PAGE_NBR like '%{search_safe}%' or 
                lower(d.GRADE) like '%{search_lower}%' or  
                lower(d.STATUS_FLAG) like '%{search_lower}%' or 
                d.AUTO_SEQNO like '%{search_safe}%')""")

        # Field-specific filters (matches CI3 lines 2199-2233)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "START_TERM" and field_name:
            search_conditions.append(f"d.START_TERM = '{check_special_name(field_name)}'")
        elif field_type == "END_TERM" and field_name:
            search_conditions.append(f"d.END_TERM = '{check_special_name(field_name)}'")
        elif field_type == "SUBJECT" and field_name:
            search_conditions.append(f"d.SUBJECT = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_FLAG" and field_name:
            search_conditions.append(f"d.STATUS_FLAG = '{check_special_name(field_name)}'")
        elif field_type == "BATCH_ID" and field_name:
            search_conditions.append(f"d.BATCH_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "STUDENT_ID" and field_name:
            search_conditions.append(f"d.STUDENT_ID like '%{check_special_name(field_name)}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "BATCH_ID": "d.BATCH_ID",
            "STUDENT_ID": "d.STUDENT_ID",
            "SUBJECT": "d.SUBJECT",
            "COURSE_ID": "d.COURSE_ID",
            "COURSE_TITLE": "d.COURSE_TITLE",
            "COMMENTS": "d.COMMENTS",
            "START_TERM_NAME": "d.START_TERM_NAME",
            "START_TERM": "d.START_TERM",
            "END_TERM": "d.END_TERM",
            "END_TERM_NAME": "d.END_TERM_NAME",
            "PERM_APPROVED": "d.PERM_APPROVED",
            "START_TERM_YEAR": "d.START_TERM_YEAR",
            "END_TERM_YEAR": "d.END_TERM_YEAR",
            "CREDIT_HOURS_EARNED": "d.CREDIT_HOURS_EARNED",
            "GRADE": "d.GRADE",
            "STATUS_FLAG": "d.STATUS_FLAG",
            "PAGE_NBR": "d.PAGE_NBR",
            "AUTO_SEQNO": "d.AUTO_SEQNO",
        }
        return column_mapping.get(column_name, "d.BATCH_ID")

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get Transcript Line DATA for DataTables
        Matches CI3 Transcripts_model::gettranscriptlinedata() method (lines 2160-2307)
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
            search_query = TranscriptLineDataModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = TranscriptLineDataModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 2239-2248)
            where_clauses = []
            if search_query:
                where_clauses.append(search_query)
            where_clauses.append(f"h.PROJECT_ID = {COLLEGE_PROJECT_ID}")
            
            where_clause = " AND ".join(where_clauses)
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_TRANSCRIPTLINEDATA} as d WITH(NOLOCK)
                INNER JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID=d.BATCH_ID
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

            # Build data query (matches CI3 lines 2250-2260)
            data_query_sql = f"""
                SELECT d.*
                FROM {TBL_TRANSCRIPTLINEDATA} as d WITH(NOLOCK)
                INNER JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID=d.BATCH_ID
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

            # Format data (matches CI3 lines 2264-2298)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")

                data_row = {
                    "BATCH_ID": batch_id,
                    "STUDENT_ID": student_id,
                    "SUBJECT": record_dict.get("SUBJECT", ""),
                    "COURSE_ID": record_dict.get("COURSE_ID", ""),
                    "COURSE_TITLE": record_dict.get("COURSE_TITLE", ""),
                    "COMMENTS": record_dict.get("COMMENTS", ""),
                    "START_TERM_NAME": record_dict.get("START_TERM_NAME", ""),
                    "START_TERM": record_dict.get("START_TERM", ""),
                    "END_TERM": record_dict.get("END_TERM", ""),
                    "END_TERM_NAME": record_dict.get("END_TERM_NAME", ""),
                    "PERM_APPROVED": record_dict.get("PERM_APPROVED", ""),
                    "START_TERM_YEAR": record_dict.get("START_TERM_YEAR", ""),
                    "END_TERM_YEAR": record_dict.get("END_TERM_YEAR", ""),
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

