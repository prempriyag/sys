"""Bot Status Report Model - Uses readDB connection"""
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class BotStatusReportModel:
    @staticmethod
    def build_search_conditions(request_data: Dict[str, Any]) -> str:
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")
        if search_value:
            search_lower = search_value.lower()
            try:
                search_date = datetime.strptime(search_value, '%Y-%m-%d').strftime('%Y-%m-%d')
            except:
                search_date = ""
            search_conditions.append(f"""(lower(JobKey) like '%{search_lower}%' or
                lower(ProcessName) like '%{search_lower}%' or
                lower(RobotName) like '%{search_lower}%' or
                CAST(TimeStamp as DATE) like '%{search_date}%' or
                lower(WindowsIdentity) like '%{search_lower}%')""")
        if search_conditions:
            return " AND ".join(search_conditions)
        return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        column_mapping = {
            "JobKey": "JobKey",
            "ProcessName": "ProcessName",
            "WindowsIdentity": "WindowsIdentity",
            "RobotName": "RobotName",
            "Job_Start_Time": "Job_Start_Time",
            "Job_End_Time": "Job_End_Time",
            "Message": "Message",
        }
        return column_mapping.get(column_name, "Job_Start_Time")

    @staticmethod
    def get_bot_status_report_data(db: Session, request_data: Dict[str, Any]) -> Dict[str, Any]:
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
                column_name = columns[column_index].get("data", "Job_Start_Time")
            else:
                column_name = "Job_Start_Time"
            
            bot_process_name = request_data.get("bot_process_name", "")
            no_of_days = int(request_data.get("no_of_days", 7))
            
            if not bot_process_name:
                bot_process_name = "'DigiScript','Articulation'"  # Default processes
            else:
                bot_process_name = f"'{bot_process_name}'"
            
            search_query = BotStatusReportModel.build_search_conditions(request_data)
            order_by_column = BotStatusReportModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            
            date_from = (datetime.now() - timedelta(days=no_of_days)).strftime('%Y-%m-%d')
            
            where_conditions = [f"Message = ProcessName + ' execution started'", f"ProcessName in ({bot_process_name})", f"[TimeStamp]>='{date_from}'"]
            if search_query:
                where_conditions.append(f"({search_query})")
            where_clause = " AND ".join(where_conditions)
            
            count_query = text(f"""
                SELECT COUNT(*) as allcount
                FROM Logs_SYN Log1 with(nolock)
                WHERE {where_clause}
            """)
            count_result = db.execute(count_query).fetchone()
            total_records = count_result.allcount if hasattr(count_result, 'allcount') else (count_result[0] if count_result else 0)
            records_filtered = total_records
            
            data_query_sql = f"""
                SELECT JobKey, ProcessName, WindowsIdentity, RobotName,
                    TimeStamp as Job_Start_Time,
                    (SELECT TimeStamp FROM Logs_SYN ST with(nolock)
                     WHERE ST.JobKey = Log1.JobKey
                     AND Message like ProcessName + ' execution ended') Job_End_Time,
                    Message
                FROM Logs_SYN Log1 with(nolock)
                WHERE {where_clause}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            records = db.execute(text(data_query_sql)).fetchall()
            data = []
            for record in records:
                record_dict = dict(record._mapping)
                job_start = record_dict.get("Job_Start_Time")
                job_end = record_dict.get("Job_End_Time")
                data_row = {
                    "JobKey": record_dict.get("JobKey", ""),
                    "ProcessName": record_dict.get("ProcessName", ""),
                    "WindowsIdentity": record_dict.get("WindowsIdentity", ""),
                    "RobotName": record_dict.get("RobotName", ""),
                    "Job_Start_Time": job_start.strftime('%Y-%m-%d %H:%M:%S') if job_start and hasattr(job_start, 'strftime') else str(job_start),
                    "Job_End_Time": job_end.strftime('%Y-%m-%d %H:%M:%S') if job_end and hasattr(job_end, 'strftime') else str(job_end),
                    "Message": record_dict.get("Message", ""),
                }
                data.append(data_row)
            return {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
            }
        except Exception as e:
            logger.error(f"Error in get_bot_status_report_data: {e}")
            raise

