"""SMTP Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_SMTP
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)

class SmtpModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_conditions.append(f"""(host LIKE '%{search_safe}%' OR
                username LIKE '%{search_safe}%' OR
                password LIKE '%{search_safe}%' OR
                port LIKE '%{search_safe}%')""")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "host": "host",
            "username": "username",
            "password": "password",
            "port": "port",
        }
        return column_mapping.get(column_name, "id")

    @staticmethod
    def get_smtp_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "id")
            else:
                column_name = "id"
            search_query = SmtpModel.build_search_conditions(request_data)
            order_by_column = SmtpModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_SMTP} WITH(NOLOCK) WHERE {where_clause}")
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
                SELECT id, host, username, password, port
                FROM {TBL_SMTP} WITH(NOLOCK)
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
                    "id": record_dict.get("id"),
                    "host": record_dict.get("host", ""),
                    "username": record_dict.get("username", ""),
                    "password": "******",  # Mask password
                    "port": record_dict.get("port", ""),
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.exception(f"Error in get_smtp_data: {e}")
            raise



