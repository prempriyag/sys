"""
DigiScript Bot Log Model
Contains all query logic for DigiScript Bot Log
Based on CI3 Digiscriptlog_model.php getdigiscriptbotlogdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging

from config.constants import (
    TBL_DIGISCRIPTBOTLOG,
    TBL_INSTITUTION_MAPPING,
    COLLEGE_PROJECT_ID,
)
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class DigiScriptBotLogModel:
    """Model for DigiScript Bot Log queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 Digiscriptlog_model.php getdigiscriptbotlogdata() search logic exactly (lines 26-135)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 28-47)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( k.BATCH_ID like '%{search_safe}%' or
                k.INSTITUTION_ID like '%{search_safe}%' or 
                lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)) LIKE '%{search_lower}%' or
                k.AUDIT_DATE like '%{search_safe}%' or
                k.STUDENT_ID like '%{search_safe}%' or 
                lower(k.STUDENT_FULL_NAME) like '%{search_lower}%' or 
                lower(k.STATUS_SAAADMS) like '%{search_lower}%' or 
                lower(k.STATUS_BDMS) like'%{search_lower}%' or 
                lower(k.STATUS_SOAPCOL) like'%{search_lower}%' or  
                lower(k.SCENARIO) like'%{search_lower}%' or 
                lower(k.COMMENTS) like'%{search_lower}%' or 
                lower(k.ERROR_REASON) like'%{search_lower}%' or 
                lower(k.TRANSCRIPT_STATUS_FLAG) like'%{search_lower}%' or
                lower(k.USER_COMMENTS) like'%{search_lower}%' or
                k.LAST_UPDATED_DATETIME like'%{search_safe}%' or 
                lower(k.UPDATED_BY) like'%{search_lower}%')""")

        # Field-specific filters (matches CI3 lines 49-131)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "COLLEGE_NAME" and field_name:
            search_conditions.append(f"k.INSTITUTION_ID = '{check_special_name(field_name)}'")
        elif field_type == "STUDENT_FULL_NAME" and field_name:
            search_conditions.append(f"UPPER(k.STUDENT_FULL_NAME) like '%{check_special_name(field_name.upper())}%'")
        elif field_type == "STUDENT_ID" and field_name:
            search_conditions.append(f"UPPER(k.STUDENT_ID) like '%{check_special_name(field_name.upper())}%'")
        elif field_type == "SCENARIO" and field_name:
            search_conditions.append(f"k.SCENARIO = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_BDMS_TRANSCRIPT" and field_name:
            search_conditions.append(f"k.STATUS_BDMS_TRANSCRIPT = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_BDMS" and field_name:
            search_conditions.append(f"k.STATUS_BDMS = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_BANNER" and field_name:
            search_conditions.append(f"k.STATUS_BANNER = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_SLATE" and field_name:
            search_conditions.append(f"k.STATUS_SLATE = '{check_special_name(field_name)}'")
        elif field_type == "TRANSCRIPT_STATUS_FLAG" and field_name:
            search_conditions.append(f"k.TRANSCRIPT_STATUS_FLAG = '{check_special_name(field_name)}'")
        elif field_type == "UPDATED_BY" and field_name and field_name != "others":
            search_conditions.append(f"k.UPDATED_BY = '{check_special_name(field_name)}'")
        elif field_type == "USER_COMMENTS" and field_name and field_name != "others":
            search_conditions.append(f"k.USER_COMMENTS = '{check_special_name(field_name)}'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)",
            "BATCH_ID": "k.BATCH_ID",
            "STUDENT_ID": "k.STUDENT_ID",
            "STUDENT_FULL_NAME": "k.STUDENT_FULL_NAME",
            "AUDIT_DATE": "k.AUDIT_DATE",
            "STATUS_BDMS": "k.STATUS_BDMS",
            "STATUS_SOAPCOL": "k.STATUS_SOAPCOL",
            "STATUS_SAAADMS": "k.STATUS_SAAADMS",
            "SCENARIO": "k.SCENARIO",
            "TRANSCRIPT_STATUS_FLAG": "k.TRANSCRIPT_STATUS_FLAG",
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
        Get DigiScript Bot Log data for DataTables
        Matches CI3 Digiscriptlog_model::getdigiscriptbotlogdata() method (lines 11-231)
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
            search_query = DigiScriptBotLogModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = DigiScriptBotLogModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records (matches CI3 lines 137-146)
            where_clauses = []
            if search_query:
                where_clauses.append(search_query)
            where_clauses.append(f"k.PROJECT_ID = {COLLEGE_PROJECT_ID}")
            
            where_clause = " AND ".join(where_clauses)
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_DIGISCRIPTBOTLOG} as k WITH(NOLOCK)
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

            # Build data query (matches CI3 lines 148-158)
            data_query_sql = f"""
                SELECT k.*,(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID) AS INSTITUTION_NAME
                FROM {TBL_DIGISCRIPTBOTLOG} as k WITH(NOLOCK)
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

            # Format data (matches CI3 lines 162-214)
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")
                transcript_link = record_dict.get("TRANSCRIPT_LINK", "")
                error_screenshot = record_dict.get("ERROR_SCREENSHOT", "")

                data_row = {
                    "INSTITUTION_ID": record_dict.get("INSTITUTION_NAME", ""),
                    "BATCH_ID": batch_id,
                    "STUDENT_ID": student_id,
                    "STUDENT_FULL_NAME": record_dict.get("STUDENT_FULL_NAME", ""),
                    "AUDIT_DATE": str(record_dict.get("AUDIT_DATE", "")) if record_dict.get("AUDIT_DATE") else "",
                    "STATUS_BDMS": record_dict.get("STATUS_BDMS", ""),
                    "STATUS_SOAPCOL": record_dict.get("STATUS_SOAPCOL", ""),
                    "STATUS_SAAADMS": record_dict.get("STATUS_SAAADMS", ""),
                    "STATUS_SOAHOLD": record_dict.get("STATUS_SOAHOLD", ""),
                    "STATUS_SLATE": record_dict.get("STATUS_SLATE", ""),
                    "STATUS_SLATE_UPLOAD": record_dict.get("STATUS_SLATE_UPLOAD", ""),
                    "STATUS_SPACMNT": record_dict.get("STATUS_SPACMNT", ""),
                    "TRANSCRIPT_STATUS_FLAG": record_dict.get("TRANSCRIPT_STATUS_FLAG", ""),
                    "ARTICULATION_STATUS_FLAG": record_dict.get("ARTICULATION_STATUS_FLAG", ""),
                    "SCENARIO": record_dict.get("SCENARIO", ""),
                    "COMMENTS": record_dict.get("COMMENTS", ""),
                    "ERROR_REASON": record_dict.get("ERROR_REASON", ""),
                    "TRANSCRIPT_LINK": transcript_link,
                    "USER_COMMENTS": record_dict.get("USER_COMMENTS", ""),
                    "ERROR_SCREENSHOT": error_screenshot,
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



