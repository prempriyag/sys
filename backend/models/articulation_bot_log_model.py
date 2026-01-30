"""
Articulation Bot Log Model
Contains all query logic for Articulation Bot Log
Based on CI3 Articulation_model.php getarticulationbotlogdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_ARTICULATIONBOTLOG,
    TBL_INSTITUTION_MAPPING,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class ArticulationBotLogModel:
    """Model for Articulation Bot Log queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Articulation_model.php getarticulationbotlogdata() search logic exactly (lines 937-1019)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 939-961)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( lower(k.SUBJECT) like '%{search_lower}%' or
                k.AUDIT_DATE like'%{search_safe}%' or
                k.BOT_AUDIT_SEQ like'%{search_safe}%' or
                k.COURSE_ID like '%{search_safe}%' or
                k.CREDIT_HOURS_EARNED like '%{search_safe}%' or
                lower(k.GRADE) like '%{search_lower}%' or
                k.BATCH_ID like '%{search_safe}%' or
                k.INSTITUTION_ID like '%{search_safe}%' or
                k.STUDENT_ID like '%{search_safe}%' or
                lower(k.STATUS_BANNER_ARTICULATION) like'%{search_lower}%' or 
                lower(k.LEVEL) like'%{search_lower}%' or 
                k.ATTENDANCE_PERIOD like'%{search_safe}%' or
                k.TERM like'%{search_safe}%' or 
                lower(k.ERROR_REASON) like'%{search_lower}%' or 
                lower(k.ARTICULATION_STATUS_FLAG) like'%{search_lower}%' or
                lower(k.ARCH_CREDITS_YN) like'%{search_lower}%' or
                lower(k.ARCH_CREDITS_ACTION) like'%{search_lower}%' or  
                k.LAST_UPDATED_DATETIME like'%{search_safe}%' or 
                lower(k.UPDATED_BY) like'%{search_lower}%' or
                lower(k.USER_COMMENTS) like'%{search_lower}%' or
                lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)) LIKE '%{search_lower}%')""")

        # Field-specific filters (matches CI3 lines 963-1015)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "COLLEGE_NAME" and field_name:
            search_conditions.append(f"k.INSTITUTION_ID = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_BANNER_ARTICULATION" and field_name:
            search_conditions.append(f"k.STATUS_BANNER_ARTICULATION like '%{check_special_name(field_name)}%'")
        elif field_type == "STUDENT_ID" and field_name:
            search_conditions.append(f"k.STUDENT_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "SUBJECT" and field_name:
            search_conditions.append(f"k.SUBJECT = '{check_special_name(field_name)}'")
        elif field_type == "TERM" and field_name:
            search_conditions.append(f"k.TERM = '{check_special_name(field_name)}'")
        elif field_type == "ARTICULATION_STATUS_FLAG" and field_name:
            search_conditions.append(f"k.ARTICULATION_STATUS_FLAG = '{check_special_name(field_name)}'")
        elif field_type == "ARCH_CREDITS_YN" and field_name:
            search_conditions.append(f"k.ARCH_CREDITS_YN = '{check_special_name(field_name)}'")
        elif field_type == "ARCH_CREDITS_ACTION" and field_name:
            search_conditions.append(f"k.ARCH_CREDITS_ACTION = '{check_special_name(field_name)}'")
        elif field_type == "UPDATED_BY" and field_name:
            search_conditions.append(f"k.UPDATED_BY = '{check_special_name(field_name)}'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def generate_transcript_pdf_url(transcript_link: str) -> str:
        """
        Generate PDF URL for transcript file with encryption
        Same as batchdetails_controller - returns encrypted URL ready for frontend
        """
        if not transcript_link or not str(transcript_link).strip():
            return ""
        
        from helpers.encryption_helper import get_encrypt_file_path
        
        # Encrypt the file path
        encrypted_path = get_encrypt_file_path(transcript_link)
        # Return the encrypted URL in the same format as batchdetails
        return f"/api/viewfile/transcript_file?pdf={encrypted_path}"

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)",
            "AUDIT_DATE": "k.AUDIT_DATE",
            "BOT_AUDIT_SEQ": "k.BOT_AUDIT_SEQ",
            "STUDENT_ID": "k.STUDENT_ID",
            "BATCH_ID": "k.BATCH_ID",
            "STATUS_BANNER_ARTICULATION": "k.STATUS_BANNER_ARTICULATION",
            "SUBJECT": "k.SUBJECT",
            "COURSE_ID": "k.COURSE_ID",
            "LEVEL": "k.LEVEL",
            "ATTENDANCE_PERIOD": "k.ATTENDANCE_PERIOD",
            "TERM": "k.TERM",
            "ARTICULATION_STATUS_FLAG": "k.ARTICULATION_STATUS_FLAG",
            "LAST_UPDATED_DATETIME": "k.LAST_UPDATED_DATETIME",
            "UPDATED_BY": "k.UPDATED_BY",
        }
        return column_mapping.get(column_name, "k.AUDIT_DATE")

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get Articulation Bot Log data for DataTables
        Matches CI3 Articulation_model::getarticulationbotlogdata() method (lines 922-1109)
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
                column_name = columns[column_index].get("data", "AUDIT_DATE")
            else:
                column_name = "AUDIT_DATE"

            # Build search conditions
            search_query = ArticulationBotLogModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = ArticulationBotLogModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 1021-1029)
            where_clause = search_query if search_query else "1=1"
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_ARTICULATIONBOTLOG} as k WITH(NOLOCK)
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

            # Build data query (matches CI3 lines 1031-1040)
            data_query_sql = f"""
                SELECT k.*,(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID) AS INSTITUTION_NAME
                FROM {TBL_ARTICULATIONBOTLOG} as k WITH(NOLOCK)
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

            # Format data (matches CI3 lines 1045-1098)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")
                transcript_link = record_dict.get("TRANSCRIPT_LINK", "")
                error_screenshot = record_dict.get("ERROR_SCREENSHOT", "")

                data_row = {
                    "INSTITUTION_ID": record_dict.get("INSTITUTION_NAME", ""),
                    "AUDIT_DATE": str(record_dict.get("AUDIT_DATE", "")) if record_dict.get("AUDIT_DATE") else "",
                    "BOT_AUDIT_SEQ": record_dict.get("BOT_AUDIT_SEQ", ""),
                    "STUDENT_ID": student_id,
                    "BATCH_ID": batch_id,
                    "USER_COMMENTS": record_dict.get("USER_COMMENTS", ""),
                    "STATUS_BANNER_ARTICULATION": record_dict.get("STATUS_BANNER_ARTICULATION", ""),
                    "SUBJECT": record_dict.get("SUBJECT", ""),
                    "COURSE_ID": record_dict.get("COURSE_ID", ""),
                    "LEVEL": record_dict.get("LEVEL", ""),
                    "ATTENDANCE_PERIOD": record_dict.get("ATTENDANCE_PERIOD", ""),
                    "TERM": record_dict.get("TERM", ""),
                    "ERROR_REASON": record_dict.get("ERROR_REASON", ""),
                    "ERROR_SCREENSHOT": error_screenshot,
                    # TRANSCRIPT_LINK: Generate encrypted URL if transcript_link exists (same as batchdetails)
                    "TRANSCRIPT_LINK": ArticulationBotLogModel.generate_transcript_pdf_url(transcript_link) if (transcript_link and str(transcript_link).strip()) else "",
                    "CREDIT_HOURS_EARNED": record_dict.get("CREDIT_HOURS_EARNED", ""),
                    "GRADE": record_dict.get("GRADE", ""),
                    "ARTICULATION_STATUS_FLAG": record_dict.get("ARTICULATION_STATUS_FLAG", ""),
                    "ARCH_CREDITS_YN": record_dict.get("ARCH_CREDITS_YN", ""),
                    "ARCH_CREDITS_ACTION": record_dict.get("ARCH_CREDITS_ACTION", ""),
                    "LAST_UPDATED_DATETIME": str(record_dict.get("LAST_UPDATED_DATETIME", "")) if record_dict.get("LAST_UPDATED_DATETIME") else "",
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
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



