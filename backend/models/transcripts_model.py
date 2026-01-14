"""
Transcripts Model
Contains all query logic for Uploaded Transcripts List
Based on CI3 Transcripts_model.php gettranscriptsdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_DOWNLOAD,
    TBL_TRANSCRIPTHDRDATA,
    TBL_INSTITUTION_MAPPING,
    COLLEGE_PROJECT_ID,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class TranscriptsModel:
    """Model for Uploaded Transcripts queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Transcripts_model.php gettranscriptsdata() search logic exactly (lines 24-93)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 27-41)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( lower(d.SOURCE_TYPE) like'%{search_lower}%' or
          LOWER(d.FILENAME) like '%{search_lower}%' or
          d.FORMATTED_FILENAME like '%{search_safe}%' or 
          lower(h.STUDENT_FULL_NAME) like '%{search_lower}%' or 
          lower(h.STUDENT_ID) like '%{search_lower}%' or 
          lower(h.INSTITUTION_ID) like '%{search_lower}%' or 
          lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = h.INSTITUTION_ID)) LIKE '%{search_lower}%' or
          LOWER(d.STATUS) like'%{search_lower}%' or
          LOWER(d.ARTICULATION_STATUS_FLAG) like '%{search_lower}%' or
          lower(d.UPLOADED_BY) like'%{search_lower}%' or
          d.BATCH_ID like'%{search_safe}%' or  
          d.UPLOADED_DATETIME like'%{search_safe}%')""")

        # Field-specific filters (matches CI3 lines 43-89)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")
        from_date = request_data.get("fromDate", "")
        to_date = request_data.get("toDate", "")

        if field_type == "BATCH_ID" and field_name:
            search_conditions.append(f"d.BATCH_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "SOURCE_TYPE" and field_name:
            search_conditions.append(f"d.SOURCE_TYPE = '{check_special_name(field_name)}'")
        elif field_type == "STATUS" and field_name:
            search_conditions.append(f"d.STATUS = '{check_special_name(field_name)}'")
        elif field_type == "ARTICULATION_STATUS_FLAG" and field_name:
            search_conditions.append(f"d.ARTICULATION_STATUS_FLAG = '{check_special_name(field_name)}'")
        elif field_type == "UPLOADED_DATETIME" and from_date and to_date:
            search_conditions.append(f"CAST(d.UPLOADED_DATETIME AS DATE) BETWEEN '{from_date}' AND '{to_date}'")
        elif field_type == "UPDATED_BY" and field_name:
            search_conditions.append(f"upper(d.UPDATED_BY) = '{check_special_name(field_name).upper()}'")
        elif field_type == "LAST_UPDATED_DATETIME" and from_date and to_date:
            search_conditions.append(f"CAST(d.LAST_UPDATED_DATETIME AS DATE) BETWEEN '{from_date}' AND '{to_date}'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "SOURCE_TYPE": "d.SOURCE_TYPE",
            "FILENAME": "d.FILENAME",
            "FORMATTED_FILENAME": "d.FORMATTED_FILENAME",
            "STUDENT_FULL_NAME": "h.STUDENT_FULL_NAME",
            "STUDENT_ID": "h.STUDENT_ID",
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = h.INSTITUTION_ID)",
            "STATUS": "d.STATUS",
            "ARTICULATION_STATUS_FLAG": "d.ARTICULATION_STATUS_FLAG",
            "UPLOADED_BY": "d.UPLOADED_BY",
            "BATCH_ID": "d.BATCH_ID",
            "UPLOADED_DATETIME": "d.UPLOADED_DATETIME",
            "LAST_UPDATED_DATETIME": "d.LAST_UPDATED_DATETIME",
        }
        return column_mapping.get(column_name, "d.UPLOADED_DATETIME")

    @staticmethod
    def get_transcripts_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get Uploaded Transcripts data for DataTables
        Matches CI3 Transcripts_model::gettranscriptsdata() method (lines 10-227)
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
                column_name = columns[column_index].get("data", "UPLOADED_DATETIME")
            else:
                column_name = "UPLOADED_DATETIME"

            # Build search conditions
            search_query = TranscriptsModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = TranscriptsModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 97-105)
            where_clauses = []
            if search_query:
                where_clauses.append(search_query)
            where_clauses.append(f"d.PROJECT_ID = {COLLEGE_PROJECT_ID}")
            
            where_clause = " AND ".join(where_clauses)
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_DOWNLOAD} as d WITH(NOLOCK)
                LEFT JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID=d.BATCH_ID
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

            # Build data query (matches CI3 lines 107-118)
            data_query_sql = f"""
                SELECT d.*,h.INSTITUTION_ID,h.EXTERNAL_INSTITUTION_ZIPCODE,h.STUDENT_FULL_NAME,h.STUDENT_ID,h.FILE_PATH,
                (SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = h.INSTITUTION_ID) AS INSTITUTION_NAME
                FROM {TBL_DOWNLOAD} as d WITH(NOLOCK)
                LEFT JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID=d.BATCH_ID
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

            # Format data (matches CI3 lines 123-216)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")
                formatted_filename = record_dict.get("FORMATTED_FILENAME", "")
                file_path = record_dict.get("FILE_PATH", "")
                filepath = record_dict.get("FILEPATH", "")

                data_row = {
                    "SOURCE_TYPE": record_dict.get("SOURCE_TYPE", ""),
                    "FILENAME": record_dict.get("FILENAME", ""),
                    "FORMATTED_FILENAME": formatted_filename,
                    "STUDENT_FULL_NAME": record_dict.get("STUDENT_FULL_NAME", ""),
                    "STUDENT_ID": student_id,
                    "INSTITUTION_ID": record_dict.get("INSTITUTION_ID", ""),
                    "INSTITUTION_NAME": record_dict.get("INSTITUTION_NAME", ""),
                    "STATUS": record_dict.get("STATUS", ""),
                    "ARTICULATION_STATUS_FLAG": record_dict.get("ARTICULATION_STATUS_FLAG", ""),
                    "UPLOADED_BY": record_dict.get("UPLOADED_BY", ""),
                    "BATCH_ID": batch_id,
                    "UPLOADED_DATETIME": str(record_dict.get("UPLOADED_DATETIME", "")) if record_dict.get("UPLOADED_DATETIME") else "",
                    "LAST_UPDATED_DATETIME": str(record_dict.get("LAST_UPDATED_DATETIME", "")) if record_dict.get("LAST_UPDATED_DATETIME") else "",
                    "FILE_PATH": file_path if file_path else (filepath + "/" + formatted_filename if filepath and formatted_filename else ""),
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
            logger.error(f"Error in get_transcripts_data: {e}")
            raise

