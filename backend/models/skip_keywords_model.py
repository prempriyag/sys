"""Skip Keywords Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_SKIP_KEYWORDS

logger = logging.getLogger(__name__)

class SkipKeywordsModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        """Build search conditions from request data"""
        search_conditions = []
        
        # Global search (main search box)
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_lower = search_value.lower()
            search_conditions.append(f"""(lower(KEYWORD) like '%{search_lower}%' or
                lower(FROM_COLUMN_NAME) like '%{search_lower}%' or
                lower(FROM_TABLE_NAME) like '%{search_lower}%' or
                lower(DISABLED_FLAG) like '%{search_lower}%' or
                lower(TO_DO) like '%{search_lower}%')""")

        # Column-specific search (individual column search boxes)
        columns = request_data.get("columns", [])
        if columns:
            for col in columns:
                col_search = col.get("search", {})
                col_search_value = col_search.get("value", "").strip() if col_search else ""
                
                if col_search_value:
                    col_data = col.get("data", "")
                    col_search_lower = col_search_value.lower()
                    
                    # Map column data names to database fields
                    if col_data == "KEYWORD":
                        search_conditions.append(f"lower(KEYWORD) like '%{col_search_lower}%'")
                    elif col_data == "FROM_COLUMN_NAME":
                        search_conditions.append(f"lower(FROM_COLUMN_NAME) like '%{col_search_lower}%'")
                    elif col_data == "FROM_TABLE_NAME":
                        search_conditions.append(f"lower(FROM_TABLE_NAME) like '%{col_search_lower}%'")
                    elif col_data == "DISABLED_FLAG":
                        search_conditions.append(f"lower(DISABLED_FLAG) like '%{col_search_lower}%'")
                    elif col_data == "TO_DO":
                        search_conditions.append(f"lower(TO_DO) like '%{col_search_lower}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "KEYWORD": "KEYWORD",
            "FROM_COLUMN_NAME": "FROM_COLUMN_NAME",
            "FROM_TABLE_NAME": "FROM_TABLE_NAME",
            "DISABLED_FLAG": "DISABLED_FLAG",
            "TO_DO": "TO_DO",
        }
        return column_mapping.get(column_name, "SNO")

    @staticmethod
    def get_skip_keywords_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "SNO")
            else:
                column_name = "SNO"
            search_query = SkipKeywordsModel.build_search_conditions(request_data)
            order_by_column = SkipKeywordsModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_SKIP_KEYWORDS} WITH(NOLOCK) WHERE {where_clause}")
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT SNO, KEYWORD, FROM_COLUMN_NAME, FROM_TABLE_NAME, DISABLED_FLAG, TO_DO
                FROM {TBL_SKIP_KEYWORDS} WITH(NOLOCK)
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
                    "SNO": record_dict.get("SNO"),
                    "KEYWORD": record_dict.get("KEYWORD", ""),
                    "FROM_COLUMN_NAME": record_dict.get("FROM_COLUMN_NAME", ""),
                    "FROM_TABLE_NAME": record_dict.get("FROM_TABLE_NAME", ""),
                    "DISABLED_FLAG": record_dict.get("DISABLED_FLAG", ""),
                    "TO_DO": record_dict.get("TO_DO", ""),
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.error(f"Error in get_skip_keywords_data: {e}")
            raise



