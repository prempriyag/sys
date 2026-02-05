"""
DigiScript Reports Model
Contains all query logic for DigiScript reports
Based on CI3 Digiscript_model.php getreportsdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_TRANSCRIPTHDRDATA,
    TBL_INSTITUTION_MAPPING,
    COLLEGE_PROJECT_ID,
)
from helpers.common_helper import check_special_name
from helpers.encryption_helper import get_encrypt_file_path

logger = logging.getLogger(__name__)


class DigiScriptReportsModel:
    """Model for DigiScript reports queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Digiscript_model.php getreportsdata() search logic exactly (lines 25-72)
        Returns: SQL WHERE clause string (without WHERE keyword)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 30-53)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( h.BATCH_ID like '%{search_safe}%' or
                h.INSTITUTION_ID like '%{search_safe}%' or 
                lower(h.STUDENT_FULL_NAME) like '%{search_lower}%' or
                h.OCR_EXTRACTED_DATE like '%{search_safe}%' or
                lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = h.INSTITUTION_ID)) LIKE '%{search_lower}%' or
                h.STUDENT_ID like '%{search_safe}%' or
                lower(h.FOUND_IN_SLATE_YN) like '%{search_lower}%' or
                lower(h.FOUND_IN_BANNER_YN) like '%{search_lower}%' or
                lower(h.DEGREE_CD) like '%{search_lower}%' or
                h.DEGREE_RECEIVED_DATE like '%{search_safe}%' or
                lower(h.SECOND_DEGREE_CD) like '%{search_lower}%' or
                h.SECOND_DEGREE_RECEIVED_DATE like '%{search_safe}%' or
                h.EFFECTIVE_TERM like '%{search_safe}%' or
                h.OCR_MIN_START_TERM like '%{search_safe}%' or
                h.OCR_MAX_END_TERM like '%{search_safe}%' or    
                lower(h.LEVEL) like '%{search_lower}%' or    
                lower(h.STATUS_FLAG) like '%{search_lower}%' or
                lower(h.COMMENTS) like '%{search_lower}%')""")

        # STUDENT_ID filter (matches CI3 lines 55-58)
        if request_data.get("STUDENT_ID"):
            search_conditions.append(f"h.STUDENT_ID = '{check_special_name(request_data['STUDENT_ID'])}'")

        # STUDENT_FULL_NAME filter (matches CI3 lines 60-63)
        if request_data.get("STUDENT_FULL_NAME"):
            student_name = check_special_name(request_data["STUDENT_FULL_NAME"].upper())
            search_conditions.append(f"h.STUDENT_FULL_NAME like '%{student_name}%'")

        # Date range filter (matches CI3 lines 65-68)
        from_date = request_data.get("from_date")
        to_date = request_data.get("to_date")
        if from_date and to_date:
            search_conditions.append(f"CAST(h.OCR_EXTRACTED_DATE AS DATE) BETWEEN '{from_date}' AND '{to_date}'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """
        Map frontend column name to SQL column for ordering
        Matches CI3 column ordering logic
        """
        column_mapping = {
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = h.INSTITUTION_ID)",
            "BATCH_ID": "h.BATCH_ID",
            "INSTITUTION_ID": "h.INSTITUTION_ID",
            "STUDENT_FULL_NAME": "h.STUDENT_FULL_NAME",
            "OCR_EXTRACTED_DATE": "h.OCR_EXTRACTED_DATE",
            "STATUS_FLAG": "h.STATUS_FLAG",
            "STUDENT_ID": "h.STUDENT_ID",
            "FOUND_IN_SLATE_YN": "h.FOUND_IN_SLATE_YN",
            "FOUND_IN_BANNER_YN": "h.FOUND_IN_BANNER_YN",
            "DEGREE_CD": "h.DEGREE_CD",
            "DEGREE_RECEIVED_DATE": "h.DEGREE_RECEIVED_DATE",
            "SECOND_DEGREE_CD": "h.SECOND_DEGREE_CD",
            "SECOND_DEGREE_RECEIVED_DATE": "h.SECOND_DEGREE_RECEIVED_DATE",
            "EFFECTIVE_TERM": "h.EFFECTIVE_TERM",
            "OCR_MIN_START_TERM": "h.OCR_MIN_START_TERM",
            "OCR_MAX_END_TERM": "h.OCR_MAX_END_TERM",
            "LEVEL": "h.LEVEL",
            "COMMENTS": "h.COMMENTS",
        }
        return column_mapping.get(column_name, "h.OCR_EXTRACTED_DATE")

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get DigiScript reports data for DataTables
        Matches CI3 Digiscript_model::getreportsdata() method (lines 11-177)
        """
        try:
            # Extract request parameters (matches CI3 lines 17-23)
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
            search_query = DigiScriptReportsModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = DigiScriptReportsModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 74-83)
            where_clauses = []
            if search_query:
                where_clauses.append(search_query)
            where_clauses.append(f"h.PROJECT_ID = {COLLEGE_PROJECT_ID}")
            
            where_clause = " AND ".join(where_clauses) if where_clauses else f"h.PROJECT_ID = {COLLEGE_PROJECT_ID}"
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK)
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

            # Build data query (matches CI3 lines 87-115)
            columns_list = f"""h.BATCH_ID,
                      h.INSTITUTION_ID,
                      h.STUDENT_FULL_NAME,
                      h.FILE_PATH,
                      h.OCR_EXTRACTED_DATE,
                      h.STATUS_FLAG,
                      h.STUDENT_ID,
                      h.FOUND_IN_SLATE_YN,
                      h.FOUND_IN_BANNER_YN,
                      h.DEGREE_CD,
                      h.DEGREE_RECEIVED_DATE,
                      h.SECOND_DEGREE_CD,
                      h.SECOND_DEGREE_RECEIVED_DATE,
                      h.EFFECTIVE_TERM,
                      h.OCR_MIN_START_TERM,
                      h.OCR_MAX_END_TERM,
                      h.LEVEL,
                      h.COMMENTS,
                      (SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = h.INSTITUTION_ID) AS INSTITUTION_NAME"""

            data_query_sql = f"""
                SELECT {columns_list}
                FROM {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK)
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

            # Format data (matches CI3 lines 119-166)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")
                institution_id = record_dict.get("INSTITUTION_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")
                file_path = record_dict.get("FILE_PATH", "")
                
                # Generate encrypted PDF URL for FILE_PATH (matches CI3 line 122)
                # CI3: $pdfpath = SESSION_PATH . 'transcript_file?pdf=' . getencryptfilepath($record->FILE_PATH);
                file_path_url = ""
                if file_path and str(file_path).strip():
                    encrypted_path = get_encrypt_file_path(file_path)
                    file_path_url = f"/api/viewfile/transcript_file?pdf={encrypted_path}"

                data_row = {
                    "INSTITUTION_NAME": record_dict.get("INSTITUTION_NAME", ""),
                    "BATCH_ID": batch_id,
                    "INSTITUTION_ID": institution_id,
                    "STUDENT_FULL_NAME": record_dict.get("STUDENT_FULL_NAME", ""),
                    "FILE_PATH": file_path_url,  # Encrypted URL, not raw path
                    "OCR_EXTRACTED_DATE": str(record_dict.get("OCR_EXTRACTED_DATE", "")) if record_dict.get("OCR_EXTRACTED_DATE") else "",
                    "STATUS_FLAG": record_dict.get("STATUS_FLAG", ""),
                    "STUDENT_ID": student_id,
                    "FOUND_IN_SLATE_YN": record_dict.get("FOUND_IN_SLATE_YN", ""),
                    "FOUND_IN_BANNER_YN": record_dict.get("FOUND_IN_BANNER_YN", ""),
                    "DEGREE_CD": record_dict.get("DEGREE_CD", ""),
                    "DEGREE_RECEIVED_DATE": str(record_dict.get("DEGREE_RECEIVED_DATE", "")) if record_dict.get("DEGREE_RECEIVED_DATE") else "",
                    "SECOND_DEGREE_CD": record_dict.get("SECOND_DEGREE_CD", ""),
                    "SECOND_DEGREE_RECEIVED_DATE": str(record_dict.get("SECOND_DEGREE_RECEIVED_DATE", "")) if record_dict.get("SECOND_DEGREE_RECEIVED_DATE") else "",
                    "EFFECTIVE_TERM": record_dict.get("EFFECTIVE_TERM", ""),
                    "OCR_MIN_START_TERM": record_dict.get("OCR_MIN_START_TERM", ""),
                    "OCR_MAX_END_TERM": record_dict.get("OCR_MAX_END_TERM", ""),
                    "LEVEL": record_dict.get("LEVEL", ""),
                    "COMMENTS": record_dict.get("COMMENTS", ""),
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



