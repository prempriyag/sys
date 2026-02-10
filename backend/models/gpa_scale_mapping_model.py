"""GPA Scale Mapping Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_GPA_SCALE_MAPPING
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)


class GpaScaleMappingModel:
    """Model for GPA Scale Mapping queries - matches CI3 Gpascalemapping controller"""

    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        """Build search conditions from request data (matching CI3 getgpascalemappingdata)"""
        search_conditions = []
        
        # Global search (main search box) - matching CI3 search
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_conditions.append(f"""(
                PERCENTAGE like '%{search_safe}%' or
                GPA like '%{search_safe}%'
            )""")

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
                    
                    if col_data == "PERCENTAGE":
                        search_conditions.append(f"PERCENTAGE like '%{col_search_safe}%'")
                    elif col_data == "GPA":
                        search_conditions.append(f"GPA like '%{col_search_safe}%'")
                    elif col_data == "UPDATED_BY":
                        search_conditions.append(f"lower(UPDATED_BY) like '%{col_search_lower}%'")
                    elif col_data == "UPDATED_DATE":
                        search_conditions.append(f"UPDATED_DATE like '%{col_search_safe}%'")

        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """Map frontend column name to SQL column for ordering"""
        column_mapping = {
            "PERCENTAGE": "PERCENTAGE",
            "GPA": "GPA",
            "UPDATED_BY": "UPDATED_BY",
            "UPDATED_DATE": "UPDATED_DATE",
        }
        return column_mapping.get(column_name, "UPDATED_DATE")

    @staticmethod
    def get_gpa_scale_mapping_data(
        db: Session,
        request_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Get GPA Scale Mapping data for DataTables
        Matches CI3 Gpascalemapping_model::getgpascalemappingdata()
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
                column_name = columns[column_index].get("data", "UPDATED_DATE")
            else:
                column_name = "UPDATED_DATE"

            # Build search conditions
            search_query = GpaScaleMappingModel.build_search_conditions(request_data)

            # Build ORDER BY clause
            order_by_column = GpaScaleMappingModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"

            # Count total records
            where_clause = search_query if search_query else "1=1"
            
            count_query = text(f"""
                SELECT count(*) as allcount
                FROM {TBL_GPA_SCALE_MAPPING} WITH(NOLOCK)
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

            # Build data query - matching CI3 SELECT *
            data_query_sql = f"""
                SELECT Id, PERCENTAGE, GPA, UPDATED_BY, UPDATED_DATE
                FROM {TBL_GPA_SCALE_MAPPING} WITH(NOLOCK)
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

            # Format data - matching CI3 response
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                
                data_row = {
                    "Id": record_dict.get("Id") or record_dict.get("id") or record_dict.get("ID"),
                    "PERCENTAGE": record_dict.get("PERCENTAGE", ""),
                    "GPA": record_dict.get("GPA", ""),
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
                    "UPDATED_DATE": str(record_dict.get("UPDATED_DATE", "")) if record_dict.get("UPDATED_DATE") else "",
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
            logger.error(f"Error in get_gpa_scale_mapping_data: {e}")
            raise
