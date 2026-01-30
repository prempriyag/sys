"""Skip Courses Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_COURSES, TBL_INSTITUTION_MAPPING

logger = logging.getLogger(__name__)

class SkipCoursesModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        """Build search conditions from request data"""
        search_conditions = []
        
        # Global search (main search box)
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_lower = search_value.lower()
            search_conditions.append(f"""(lower(c.INSTITUTION_ID) like '%{search_value}%' or 
                lower(m.INSTITUTION_NAME) like '%{search_lower}%' or 
                lower(c.CATEGORY) like '%{search_lower}%' or 
                lower(c.EXTERNAL_SUBJECT) like '%{search_lower}%' or 
                lower(c.UPDATED_BY) like '%{search_lower}%' or
                c.LAST_UPDATED_DATETIME like '%{search_value}%' or 
                lower(c.EXTERNAL_COURSE_ID) like '%{search_value}%')""")

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
                    if col_data == "INSTITUTION_ID":
                        search_conditions.append(f"lower(c.INSTITUTION_ID) like '%{col_search_value}%'")
                    elif col_data == "INSTITUTION_NAME":
                        search_conditions.append(f"lower(m.INSTITUTION_NAME) like '%{col_search_lower}%'")
                    elif col_data == "CATEGORY":
                        search_conditions.append(f"lower(c.CATEGORY) like '%{col_search_lower}%'")
                    elif col_data == "EXTERNAL_SUBJECT":
                        search_conditions.append(f"lower(c.EXTERNAL_SUBJECT) like '%{col_search_lower}%'")
                    elif col_data == "EXTERNAL_COURSE_ID":
                        search_conditions.append(f"lower(c.EXTERNAL_COURSE_ID) like '%{col_search_value}%'")
                    elif col_data == "UPDATED_BY":
                        search_conditions.append(f"lower(c.UPDATED_BY) like '%{col_search_lower}%'")
                    elif col_data == "LAST_UPDATED_DATETIME":
                        search_conditions.append(f"c.LAST_UPDATED_DATETIME like '%{col_search_value}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "INSTITUTION_ID": "c.INSTITUTION_ID",
            "INSTITUTION_NAME": "m.INSTITUTION_NAME",
            "CATEGORY": "c.CATEGORY",
            "EXTERNAL_SUBJECT": "c.EXTERNAL_SUBJECT",
            "EXTERNAL_COURSE_ID": "c.EXTERNAL_COURSE_ID",
            "UPDATED_BY": "c.UPDATED_BY",
            "LAST_UPDATED_DATETIME": "c.LAST_UPDATED_DATETIME",
        }
        return column_mapping.get(column_name, "c.LAST_UPDATED_DATETIME")

    @staticmethod
    def get_skip_courses_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "c.LAST_UPDATED_DATETIME")
            else:
                column_name = "c.LAST_UPDATED_DATETIME"
            search_query = SkipCoursesModel.build_search_conditions(request_data)
            order_by_column = SkipCoursesModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_COURSES} as c WITH(NOLOCK)
                LEFT JOIN {TBL_INSTITUTION_MAPPING} as m WITH(NOLOCK) ON c.INSTITUTION_ID=m.INSTITUTION_ID
                WHERE {where_clause}
            """)
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT c.Id as skid, c.INSTITUTION_ID, c.CATEGORY, c.EXTERNAL_SUBJECT, c.EXTERNAL_COURSE_ID,
                    c.UPDATED_BY, c.LAST_UPDATED_DATETIME, m.INSTITUTION_NAME
                FROM {TBL_COURSES} as c WITH(NOLOCK)
                LEFT JOIN {TBL_INSTITUTION_MAPPING} as m WITH(NOLOCK) ON c.INSTITUTION_ID=m.INSTITUTION_ID
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
                    "skid": record_dict.get("skid"),
                    "INSTITUTION_ID": record_dict.get("INSTITUTION_ID", ""),
                    "INSTITUTION_NAME": record_dict.get("INSTITUTION_NAME", ""),
                    "CATEGORY": record_dict.get("CATEGORY", ""),
                    "EXTERNAL_SUBJECT": record_dict.get("EXTERNAL_SUBJECT", ""),
                    "EXTERNAL_COURSE_ID": record_dict.get("EXTERNAL_COURSE_ID", ""),
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
            logger.error(f"Error in get_skip_courses_data: {e}")
            raise

