"""Accredited Institution Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_ACCREDITED_INSTITUTION, TBL_INSTITUTION_MAPPING
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)

class AccreditedInstitutionModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(lower(a.EFFECTIVE_START_TERM) like '%{search_lower}%' or
                lower(a.EFFECTIVE_END_TERM) like '%{search_lower}%' or
                a.INSTITUTION_ID like'%{search_safe}%' or
                lower(m.INSTITUTION_NAME) like '%{search_lower}%' or
                lower(a.UPDATED_BY) like '%{search_lower}%' or
                a.UPDATED_ON like'%{search_safe}%')""")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "INSTITUTION_ID": "a.INSTITUTION_ID",
            "INSTITUTION_NAME": "m.INSTITUTION_NAME",
            "EFFECTIVE_START_TERM": "a.EFFECTIVE_START_TERM",
            "EFFECTIVE_END_TERM": "a.EFFECTIVE_END_TERM",
            "UPDATED_BY": "a.UPDATED_BY",
            "UPDATED_ON": "a.UPDATED_ON",
        }
        return column_mapping.get(column_name, "a.UPDATED_ON")

    @staticmethod
    def get_accredited_institution_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "a.UPDATED_ON")
            else:
                column_name = "a.UPDATED_ON"
            search_query = AccreditedInstitutionModel.build_search_conditions(request_data)
            order_by_column = AccreditedInstitutionModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_ACCREDITED_INSTITUTION} as a WITH(NOLOCK)
                LEFT JOIN {TBL_INSTITUTION_MAPPING} as m WITH(NOLOCK) ON m.INSTITUTION_ID=a.INSTITUTION_ID
                WHERE {where_clause}
            """)
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT DISTINCT a.Id, a.INSTITUTION_ID, m.INSTITUTION_NAME, a.EFFECTIVE_START_TERM,
                    a.EFFECTIVE_END_TERM, a.UPDATED_BY, a.UPDATED_ON
                FROM {TBL_ACCREDITED_INSTITUTION} as a WITH(NOLOCK)
                LEFT JOIN {TBL_INSTITUTION_MAPPING} as m WITH(NOLOCK) ON m.INSTITUTION_ID=a.INSTITUTION_ID
                WHERE {where_clause}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            records = db.execute(text(data_query_sql)).fetchall()
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                inst_id = record_dict.get("INSTITUTION_ID", "")
                data_row = {
                    "Id": record_dict.get("Id"),
                    "INSTITUTION_ID": inst_id,
                    "INSTITUTION_NAME": record_dict.get("INSTITUTION_NAME", ""),
                    "EFFECTIVE_START_TERM": record_dict.get("EFFECTIVE_START_TERM", ""),
                    "EFFECTIVE_END_TERM": record_dict.get("EFFECTIVE_END_TERM", ""),
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
                    "UPDATED_ON": str(record_dict.get("UPDATED_ON", "")) if record_dict.get("UPDATED_ON") else "",
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.error(f"Error in get_accredited_institution_data: {e}")
            raise

