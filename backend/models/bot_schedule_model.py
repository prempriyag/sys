"""Bot Schedule Model"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from config.constants import TBL_BOT_SCHEDULE

logger = logging.getLogger(__name__)

class BotScheduleModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_lower = search_value.lower()
            search_conditions.append(f"""(lower(PROJECT) like '%{search_lower}%' or 
                lower(BOTNAME) like '%{search_lower}%' or 
                STARTIST like'%{search_value}%' or 
                AVERAGETIME like'%{search_value}%' or
                lower(FREQUENCY) like '%{search_lower}%' or
                FINISHFIRSTRUN like '%{search_value}%' or
                SERVERIP like'%{search_value}%' or
                lower(USERNAME) like '%{search_lower}%' or
                CREATEDON like '%{search_value}%' or
                lower(CREATEDBY) like '%{search_lower}%' or
                UPDATEDON like '%{search_value}%' or
                lower(UPDATEDBY) like '%{search_lower}%')""")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "PROJECT": "PROJECT",
            "BOTNAME": "BOTNAME",
            "STARTIST": "STARTIST",
            "AVERAGETIME": "AVERAGETIME",
            "FREQUENCY": "FREQUENCY",
            "FINISHFIRSTRUN": "FINISHFIRSTRUN",
            "SERVERIP": "SERVERIP",
            "USERNAME": "USERNAME",
            "CREATEDON": "CREATEDON",
            "CREATEDBY": "CREATEDBY",
            "UPDATEDON": "UPDATEDON",
            "UPDATEDBY": "UPDATEDBY",
        }
        return column_mapping.get(column_name, "CREATEDON")

    @staticmethod
    def get_bot_schedule_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "CREATEDON")
            else:
                column_name = "CREATEDON"
            search_query = BotScheduleModel.build_search_conditions(request_data)
            order_by_column = BotScheduleModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            where_clause = search_query if search_query else "1=1"
            count_query = text(f"SELECT count(*) as allcount FROM {TBL_BOT_SCHEDULE} WITH(NOLOCK) WHERE {where_clause}")
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            data_query_sql = f"""
                SELECT Id, PROJECT, BOTNAME, STARTIST, AVERAGETIME, FREQUENCY, FINISHFIRSTRUN,
                    SERVERIP, USERNAME, CREATEDON, CREATEDBY, UPDATEDON, UPDATEDBY
                FROM {TBL_BOT_SCHEDULE} WITH(NOLOCK)
                WHERE {where_clause}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            records = db.execute(text(data_query_sql)).fetchall()
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                start_ist = record_dict.get("STARTIST", "")
                finish_first = record_dict.get("FINISHFIRSTRUN", "")
                avg_time = record_dict.get("AVERAGETIME", "")
                created_on = record_dict.get("CREATEDON", "")
                updated_on = record_dict.get("UPDATEDON", "")
                data_row = {
                    "Id": record_dict.get("Id"),
                    "PROJECT": record_dict.get("PROJECT", ""),
                    "BOTNAME": record_dict.get("BOTNAME", ""),
                    "STARTIST": start_ist.strftime(" %I:%M %p") if start_ist and hasattr(start_ist, 'strftime') else start_ist,
                    "AVERAGETIME": avg_time[:8] if avg_time and len(str(avg_time)) > 8 else avg_time,
                    "FREQUENCY": record_dict.get("FREQUENCY", ""),
                    "FINISHFIRSTRUN": finish_first.strftime(" %I:%M %p") if finish_first and hasattr(finish_first, 'strftime') else finish_first,
                    "SERVERIP": record_dict.get("SERVERIP", ""),
                    "USERNAME": record_dict.get("USERNAME", ""),
                    "CREATEDON": created_on.strftime("%m/%d/%y %I:%M %p") if created_on and hasattr(created_on, 'strftime') else str(created_on),
                    "CREATEDBY": record_dict.get("CREATEDBY", ""),
                    "UPDATEDON": updated_on.strftime("%m/%d/%y %I:%M %p") if updated_on and hasattr(updated_on, 'strftime') else str(updated_on),
                    "UPDATEDBY": record_dict.get("UPDATEDBY", ""),
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.error(f"Error in get_bot_schedule_data: {e}")
            raise



