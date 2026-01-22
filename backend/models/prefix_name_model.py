"""Prefix Name Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_PrefixName
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)

class PrefixNameModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        """Build search conditions from request data"""
        search_conditions = []
        
        # Global search (main search box)
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(lower(Prefix) like '%{search_lower}%' or 
                lower(Updated_By) like '%{search_lower}%' or
                Updated_on like '%{search_safe}%' or
                lower(ID) like '%{search_lower}%')""")

        # Column-specific search (individual column search boxes)
        columns = request_data.get("columns", [])
        if columns:
            for col in columns:
                col_search = col.get("search", {})
                col_search_value = col_search.get("value", "").strip() if col_search else ""
                
                if col_search_value:
                    col_data = col.get("data", "")
                    col_search_safe = check_special_name(col_search_value)
                    col_search_lower = check_special_name(col_search_value.lower())
                    
                    # Map column data names to database fields
                    if col_data == "Prefix":
                        search_conditions.append(f"lower(Prefix) like '%{col_search_lower}%'")
                    elif col_data == "Updated_By":
                        search_conditions.append(f"lower(Updated_By) like '%{col_search_lower}%'")
                    elif col_data == "Updated_on":
                        search_conditions.append(f"Updated_on like '%{col_search_safe}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "Prefix": "Prefix",
            "Updated_By": "Updated_By",
            "Updated_on": "Updated_on",
        }
        return column_mapping.get(column_name, "Updated_on")

    @staticmethod
    def get_prefix_name_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "Updated_on")
            else:
                column_name = "Updated_on"
            search_query = PrefixNameModel.build_search_conditions(request_data)
            order_by_column = PrefixNameModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_PrefixName} WITH(NOLOCK) WHERE {where_clause}")
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT ID, Prefix, Updated_By, Updated_on
                FROM {TBL_PrefixName} WITH(NOLOCK)
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
                    "Prefix": record_dict.get("Prefix", ""),
                    "Updated_By": record_dict.get("Updated_By", ""),
                    "Updated_on": str(record_dict.get("Updated_on", "")) if record_dict.get("Updated_on") else "",
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.error(f"Error in get_prefix_name_data: {e}")
            raise



