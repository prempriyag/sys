"""Accepted Grades Mapping Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_ACCEPTED_GRADES_MAPPING
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)

class AcceptedGradesMappingModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        """Build search conditions from request data"""
        search_conditions = []
        
        # Global search (main search box)
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(INSTITUTION_ID like '%{search_safe}%' or
                lower(ACCEPTED_GRADE) like '%{search_lower}%' or
                lower(TRANSFER_GRADE) like '%{search_lower}%' or
                lower(UPDATED_BY) like '%{search_lower}%')""")

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
                    if col_data == "INSTITUTION_ID":
                        search_conditions.append(f"INSTITUTION_ID like '%{col_search_safe}%'")
                    elif col_data == "ACCEPTED_GRADE":
                        search_conditions.append(f"lower(ACCEPTED_GRADE) like '%{col_search_lower}%'")
                    elif col_data == "TRANSFER_GRADE":
                        search_conditions.append(f"lower(TRANSFER_GRADE) like '%{col_search_lower}%'")
                    elif col_data == "UPDATED_BY":
                        search_conditions.append(f"lower(UPDATED_BY) like '%{col_search_lower}%'")
                    elif col_data == "UPDATED_ON":
                        search_conditions.append(f"UPDATED_ON like '%{col_search_safe}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "INSTITUTION_ID": "INSTITUTION_ID",
            "ACCEPTED_GRADE": "ACCEPTED_GRADE",
            "TRANSFER_GRADE": "TRANSFER_GRADE",
            "UPDATED_BY": "UPDATED_BY",
            "UPDATED_ON": "UPDATED_ON",
        }
        return column_mapping.get(column_name, "UPDATED_ON")

    @staticmethod
    def get_accepted_grades_mapping_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "UPDATED_ON")
            else:
                column_name = "UPDATED_ON"
            search_query = AcceptedGradesMappingModel.build_search_conditions(request_data)
            order_by_column = AcceptedGradesMappingModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_ACCEPTED_GRADES_MAPPING} WITH(NOLOCK) WHERE {where_clause}")
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
                SELECT ID, INSTITUTION_ID, ACCEPTED_GRADE, TRANSFER_GRADE, UPDATED_BY, UPDATED_ON
                FROM {TBL_ACCEPTED_GRADES_MAPPING} WITH(NOLOCK)
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
                    "INSTITUTION_ID": record_dict.get("INSTITUTION_ID", ""),
                    "ACCEPTED_GRADE": record_dict.get("ACCEPTED_GRADE", ""),
                    "TRANSFER_GRADE": record_dict.get("TRANSFER_GRADE", ""),
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
            logger.exception(f"Error in get_accepted_grades_mapping_data: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise

