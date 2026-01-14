"""Institution Mapping Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_INSTITUTION_MAPPING
from helpers.common_helper import check_special_name

logger = logging.getLogger(__name__)

class InstitutionMappingModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any], inst_type: str = "") -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())
            search_conditions.append(f"""(INSTITUTION_ID like '%{search_safe}%' or 
                lower(INSTITUTION_TYPE) like '%{search_lower}%' or 
                lower(INSTITUTION_NAME) like '%{search_lower}%' or 
                SLATE_INSTITUTION_ID like '%{search_safe}%' or 
                lower(SLATE_INSTITUTION_NAME) like '%{search_lower}%' or 
                INSTITUTION_ZIPCODE like'%{search_safe}%' or 
                EXTERNAL_INSTITUTION_ZIPCODE like'%{search_safe}%' or 
                lower(EXTERNAL_INSTITUTION_NAME) like'%{search_lower}%' or
                lower(UPDATED_BY) like'%{search_lower}%' or   		 
                LAST_UPDATED_DATETIME like '%{search_safe}%' or  
                lower(SLATE_INSTITUTION_NAME) like'%{search_lower}%')""")
        if inst_type == 'C':
            search_conditions.append("INSTITUTION_TYPE IN ('C')")
        elif inst_type == 'H':
            search_conditions.append("INSTITUTION_TYPE IN ('H')")
        elif inst_type == 'TECH':
            search_conditions.append("INSTITUTION_TYPE IN ('TECH')")
        elif inst_type == 'ocr':
            search_conditions.append("INSTITUTION_TYPE IN ('OCR')")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "SOURCE_TYPE": "SOURCE_TYPE",
            "INSTITUTION_TYPE": "INSTITUTION_TYPE",
            "INSTITUTION_ID": "INSTITUTION_ID",
            "INSTITUTION_NAME": "INSTITUTION_NAME",
            "INSTITUTION_ZIPCODE": "INSTITUTION_ZIPCODE",
            "EXTERNAL_INSTITUTION_NAME": "EXTERNAL_INSTITUTION_NAME",
            "SLATE_INSTITUTION_ID": "SLATE_INSTITUTION_ID",
            "SLATE_INSTITUTION_NAME": "SLATE_INSTITUTION_NAME",
            "EXTERNAL_INSTITUTION_ZIPCODE": "EXTERNAL_INSTITUTION_ZIPCODE",
            "UPDATED_BY": "UPDATED_BY",
            "LAST_UPDATED_DATETIME": "LAST_UPDATED_DATETIME",
        }
        return column_mapping.get(column_name, "LAST_UPDATED_DATETIME")

    @staticmethod
    def get_institution_mapping_data(db: Session, request_data: Dict[str, Any], inst_type: str = "") -> Dict[str, Any]:
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
            search_query = InstitutionMappingModel.build_search_conditions(request_data, inst_type)
            order_by_column = InstitutionMappingModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_INSTITUTION_MAPPING} WITH(NOLOCK) WHERE {where_clause}")
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT Id, SOURCE_TYPE, INSTITUTION_TYPE, INSTITUTION_ID, INSTITUTION_NAME, INSTITUTION_ZIPCODE,
                    EXTERNAL_INSTITUTION_NAME, SLATE_INSTITUTION_ID, SLATE_INSTITUTION_NAME,
                    EXTERNAL_INSTITUTION_ZIPCODE, UPDATED_BY, LAST_UPDATED_DATETIME
                FROM {TBL_INSTITUTION_MAPPING} WITH(NOLOCK)
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
                inst_name = record_dict.get("INSTITUTION_NAME", "")
                inst_zip = record_dict.get("INSTITUTION_ZIPCODE", "")
                data_row = {
                    "Id": record_dict.get("Id"),
                    "SOURCE_TYPE": record_dict.get("SOURCE_TYPE", ""),
                    "INSTITUTION_TYPE": record_dict.get("INSTITUTION_TYPE", ""),
                    "INSTITUTION_ID": inst_id,
                    "INSTITUTION_NAME": inst_name,
                    "INSTITUTION_ZIPCODE": inst_zip,
                    "EXTERNAL_INSTITUTION_NAME": record_dict.get("EXTERNAL_INSTITUTION_NAME", ""),
                    "SLATE_INSTITUTION_ID": record_dict.get("SLATE_INSTITUTION_ID", ""),
                    "SLATE_INSTITUTION_NAME": record_dict.get("SLATE_INSTITUTION_NAME", ""),
                    "EXTERNAL_INSTITUTION_ZIPCODE": record_dict.get("EXTERNAL_INSTITUTION_ZIPCODE", ""),
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
            logger.error(f"Error in get_institution_mapping_data: {e}")
            raise

