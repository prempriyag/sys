"""
Term Mapping Model
Based on CI3 Mapping_model.php gettermmappingdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_TERM_MAPPING
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class TermMappingModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(lower(TERM) like '%{search_lower}%' or 
                lower(TERM_CODE) like '%{search_lower}%' or 
                TERM_START like'%{search_safe}%' or 
                GRACE_PERIOD like'%{search_safe}%' or
                lower(UPDATED_BY) like '%{search_lower}%' or
                LAST_UPDATED_DATETIME like '%{search_safe}%' or                
                TERM_END like'%{search_safe}%')""")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "TERM": "TERM",
            "TERM_CODE": "TERM_CODE",
            "TERM_START": "TERM_START",
            "TERM_END": "TERM_END",
            "IS_ACTIVE": "IS_ACTIVE",
            "GRACE_PERIOD": "GRACE_PERIOD",
            "UPDATED_BY": "UPDATED_BY",
            "LAST_UPDATED_DATETIME": "LAST_UPDATED_DATETIME",
        }
        return column_mapping.get(column_name, "LAST_UPDATED_DATETIME")

    @staticmethod
    def get_term_mapping_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "LAST_UPDATED_DATETIME")
            else:
                column_name = "LAST_UPDATED_DATETIME"
            search_query = TermMappingModel.build_search_conditions(request_data)
            order_by_column = TermMappingModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_TERM_MAPPING} WITH(NOLOCK) WHERE {where_clause}")
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT Id, TERM, TERM_CODE, TERM_START, TERM_END, IS_ACTIVE, GRACE_PERIOD, UPDATED_BY, LAST_UPDATED_DATETIME
                FROM {TBL_TERM_MAPPING} WITH(NOLOCK)
                WHERE {where_clause}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            records = db.execute(text(data_query_sql)).fetchall()
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                active = "Active" if record_dict.get("IS_ACTIVE") == "Y" else ("InActive" if record_dict.get("IS_ACTIVE") == "N" else "")
                data_row = {
                    "Id": record_dict.get("Id"),
                    "TERM": record_dict.get("TERM", ""),
                    "TERM_CODE": record_dict.get("TERM_CODE", ""),
                    "TERM_START": record_dict.get("TERM_START", ""),
                    "TERM_END": record_dict.get("TERM_END", ""),
                    "IS_ACTIVE": active,
                    "GRACE_PERIOD": record_dict.get("GRACE_PERIOD", ""),
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
                    "LAST_UPDATED_DATETIME": str(record_dict.get("LAST_UPDATED_DATETIME", "")) if record_dict.get("LAST_UPDATED_DATETIME") else "",
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.error(f"Error in get_term_mapping_data: {e}")
            raise

