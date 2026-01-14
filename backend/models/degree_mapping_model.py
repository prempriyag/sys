"""
Degree Mapping Model
Contains query logic for Degree Mapping CRUD operations
Based on CI3 Mapping_model.php getdegreemappingdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging

from config.constants import TBL_DEGREE
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class DegreeMappingModel:
    """Model for Degree Mapping queries"""

    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        """Build search conditions from request data"""
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(DEGREE_CD like '%{search_safe}%' or 
                lower(DEGREE_NAME) like '%{search_lower}%' or 
                lower(UPDATED_BY) like '%{search_lower}%' or 
                LAST_UPDATED_DATETIME like '%{search_safe}%')""")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "DEGREE_CD": "DEGREE_CD",
            "DEGREE_NAME": "DEGREE_NAME",
            "UPDATED_BY": "UPDATED_BY",
            "LAST_UPDATED_DATETIME": "LAST_UPDATED_DATETIME",
        }
        return column_mapping.get(column_name, "LAST_UPDATED_DATETIME")

    @staticmethod
    def get_degree_mapping_data(
        db: Session,
        request_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Get Degree Mapping data for DataTables
        Matches CI3 Mapping_model::getdegreemappingdata() method
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
                column_name = columns[column_index].get("data", "LAST_UPDATED_DATETIME")
            else:
                column_name = "LAST_UPDATED_DATETIME"

            # Build search conditions
            search_query = DegreeMappingModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = DegreeMappingModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records
            where_clause = search_query if search_query else "1=1"
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_DEGREE}
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

            # Build data query
            data_query_sql = f"""
                SELECT Id, DEGREE_CD, DEGREE_NAME, UPDATED_BY, LAST_UPDATED_DATETIME
                FROM {TBL_DEGREE}
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

            # Format data
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                data_row = {
                    "Id": record_dict.get("Id"),
                    "DEGREE_CD": record_dict.get("DEGREE_CD", ""),
                    "DEGREE_NAME": record_dict.get("DEGREE_NAME", ""),
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
                    "LAST_UPDATED_DATETIME": str(record_dict.get("LAST_UPDATED_DATETIME", "")) if record_dict.get("LAST_UPDATED_DATETIME") else "",
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
            logger.error(f"Error in get_degree_mapping_data: {e}")
            raise

