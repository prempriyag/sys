"""Error Log Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)

class ErrorLogModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(LOWER(ERROR_TYPE) LIKE '%{search_lower}%' OR
                LOWER(ERROR_MESSAGE) LIKE '%{search_lower}%' OR
                LOWER(FILE_NAME) LIKE '%{search_lower}%' OR
                LOWER(CONTROLLER) LIKE '%{search_lower}%' OR
                LOWER(METHOD) LIKE '%{search_lower}%' OR
                LOWER(URL) LIKE '%{search_lower}%' OR
                LOWER(SESSION_USERNAME) LIKE '%{search_lower}%' OR
                LOWER(SESSION_EMAIL) LIKE '%{search_lower}%')""")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "ERROR_TYPE": "ERROR_TYPE",
            "ERROR_MESSAGE": "ERROR_MESSAGE",
            "FILE_NAME": "FILE_NAME",
            "LINE_NUMBER": "LINE_NUMBER",
            "CONTROLLER": "CONTROLLER",
            "METHOD": "METHOD",
            "URL": "URL",
            "IP_ADDRESS": "IP_ADDRESS",
            "HOSTNAME": "HOSTNAME",
            "SESSION_USERNAME": "SESSION_USERNAME",
            "SESSION_EMAIL": "SESSION_EMAIL",
            "CREATED_ON": "CREATED_ON",
            "STATUS": "STATUS",
        }
        return column_mapping.get(column_name, "CREATED_ON")

    @staticmethod
    def get_error_log_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
        try:
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
                column_name = columns[column_index].get("data", "CREATED_ON")
            else:
                column_name = "CREATED_ON"
            search_query = ErrorLogModel.build_search_conditions(request_data)
            order_by_column = ErrorLogModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM Error_Log WITH(NOLOCK) WHERE {where_clause}")
            count_result = db.execute(count_query).fetchone()
            if count_result:
                try:
                    total_records = count_result.allcount
                except AttributeError:
                    total_records = count_result[0] if count_result else 0
            else:
                total_records = 0
            records_filtered = total_records
            data_query_sql = f"""
                SELECT ID, ERROR_TYPE, ERROR_MESSAGE, FILE_NAME, LINE_NUMBER, CONTROLLER, METHOD, URL, 
                       IP_ADDRESS, HOSTNAME, SESSION_USERNAME, SESSION_EMAIL, CREATED_ON, STATUS
                FROM Error_Log WITH(NOLOCK)
                WHERE {where_clause}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            records = db.execute(text(data_query_sql)).fetchall()
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                data_row = {
                    "ID": record_dict.get("ID"),
                    "ERROR_TYPE": record_dict.get("ERROR_TYPE", ""),
                    "ERROR_MESSAGE": record_dict.get("ERROR_MESSAGE", ""),
                    "FILE_NAME": record_dict.get("FILE_NAME", ""),
                    "LINE_NUMBER": record_dict.get("LINE_NUMBER", ""),
                    "CONTROLLER": record_dict.get("CONTROLLER", ""),
                    "METHOD": record_dict.get("METHOD", ""),
                    "URL": record_dict.get("URL", ""),
                    "IP_ADDRESS": record_dict.get("IP_ADDRESS", ""),
                    "HOSTNAME": record_dict.get("HOSTNAME", ""),
                    "SESSION_USERNAME": record_dict.get("SESSION_USERNAME", ""),
                    "SESSION_EMAIL": record_dict.get("SESSION_EMAIL", ""),
                    "CREATED_ON": str(record_dict.get("CREATED_ON", "")) if record_dict.get("CREATED_ON") else "",
                    "STATUS": record_dict.get("STATUS", ""),
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.exception(f"Error in get_error_log_data: {e}")
            raise

