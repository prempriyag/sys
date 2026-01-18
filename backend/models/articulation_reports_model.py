"""
Articulation Reports Model
Contains all query logic for articulation reports
Based on CI3 Articulation_model.php getreportsdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging
import re
from datetime import datetime

from config.constants import (
    TBL_KICKOUT,
    TBL_ARTICULATION,
    TBL_INSTITUTION_MAPPING,
)
from helpers.common_helper import check_special_name, ymd_date_format

logger = logging.getLogger(__name__)


class ArticulationReportsModel:
    """Model for articulation reports queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 getreportsdata() search logic exactly (lines 25-177)
        Returns: SQL WHERE clause string (without WHERE keyword)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 30-56)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( lower(k.SUBJECT) like '%{search_lower}%' or
                lower(k.EQV_SUBJECT) like '%{search_lower}%' or
                k.COURSE_ID like '%{search_safe}%' or
                lower(k.COURSE_TITLE) like '%{search_lower}%' or
                k.EQV_COURSE_ID like '%{search_safe}%' or
                k.EQV_CREDIT_HOURS_EARNED like '%{search_safe}%' or
                k.EQV_GRADE like '%{search_safe}%' or
                lower(k.ARTICULATION_INDICATOR) like'%{search_lower}%' or 
                k.CREDIT_HOURS_EARNED like '%{search_safe}%' or
                lower(k.GRADE) like '%{search_lower}%' or
                k.BATCH_ID like '%{search_safe}%' or
                k.INSTITUTION_ID like '%{search_safe}%' or 
                lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)) LIKE '%{search_lower}%' or
                lower(d.STUDENT_FULL_NAME) like '%{search_lower}%' or
                k.STUDENT_ID like '%{search_safe}%' or
                lower(k.STATUS_BANNER_ARTICULATION) like'%{search_lower}%' or 
                lower(k.LEVEL) like'%{search_lower}%' or 
                k.ATTENDANCE_PERIOD like'%{search_safe}%' or
                k.TERM like'%{search_safe}%' or 
                lower(k.ERROR_REASON) like'%{search_lower}%' or 
                lower(k.ARTICULATION_STATUS_FLAG) like'%{search_lower}%' or 
                k.LAST_UPDATED_DATETIME like'%{search_safe}%' or 
                lower(k.UPDATED_BY) like'%{search_lower}%' or
                lower(k.USER_COMMENTS) like'%{search_lower}%') """)

        # Search_Field filters (matches CI3 lines 58-71)
        search_field = request_data.get("Search_Field", "")

        if search_field == "Processed":
            search_conditions.append(
                "(upper(k.ARTICULATION_STATUS_FLAG) = 'PROCESSED' OR upper(k.ARTICULATION_STATUS_FLAG) = 'SKIP/EXCLUDE')"
            )
        elif search_field == "Failed":
            search_conditions.append("(upper(k.ARTICULATION_STATUS_FLAG) = 'FAILED')")
        elif search_field == "Phase_2":
            search_conditions.append("(upper(k.ARTICULATION_STATUS_FLAG) = 'FAILED')")
        elif search_field == "Rerun":
            search_conditions.append("(upper(k.ARTICULATION_STATUS_FLAG) = 'RERUN')")

        # Field type filters (matches CI3 lines 73-170)
        field_type = request_data.get("fieldType", "")
        field_name = request_data.get("fieldName", "")

        if field_type == "COLLEGE_ID" and field_name:
            search_conditions.append(f"k.INSTITUTION_ID = '{check_special_name(field_name)}'")
        elif field_type == "COLLEGE_NAME" and field_name:
            search_conditions.append(f"k.INSTITUTION_ID = '{check_special_name(field_name)}'")
        elif field_type == "LEVEL" and field_name:
            search_conditions.append(f"k.LEVEL = '{check_special_name(field_name)}'")
        elif field_type == "STATUS_BANNER_ARTICULATION" and field_name:
            search_conditions.append(f"k.STATUS_BANNER_ARTICULATION = '{check_special_name(field_name)}'")
        elif field_type == "STUDENT_ID" and field_name:
            search_conditions.append(f"UPPER(k.STUDENT_ID) like '%{check_special_name(field_name.upper())}%'")
        elif field_type == "BATCH_ID" and field_name:
            search_conditions.append(f"k.BATCH_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "INSTITUTION_ID" and field_name:
            search_conditions.append(f"k.INSTITUTION_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "COURSE_TITLE" and field_name:
            search_conditions.append(f"k.COURSE_TITLE like '%{check_special_name(field_name)}%'")
        elif field_type == "COURSE_ID" and field_name:
            search_conditions.append(f"k.COURSE_ID like '%{check_special_name(field_name)}%'")
        elif field_type == "ARTICULATION_STATUS_FLAG" and field_name:
            search_conditions.append(f"k.ARTICULATION_STATUS_FLAG = '{check_special_name(field_name)}'")
        elif field_type == "ERROR_REASON" and field_name:
            search_conditions.append(f"lower(k.ERROR_REASON) like '%{check_special_name(field_name.lower())}%'")
        elif field_type == "USER_COMMENTS" and field_name:
            search_conditions.append(f"lower(k.USER_COMMENTS) like '%{check_special_name(field_name.lower())}%'")
        elif field_type == "UPDATED_BY" and field_name:
            if field_name == "others":
                search_conditions.append("k.UPDATED_BY != 'Transcript BOT' AND k.UPDATED_BY != 'Articulation BOT'")
            else:
                search_conditions.append(f"k.UPDATED_BY = '{check_special_name(field_name)}'")
        elif field_type == "UPDATED_DATE":
            from_date = request_data.get("fromDate")
            to_date = request_data.get("toDate")
            if from_date and to_date:
                search_conditions.append(
                    f"CAST(k.LAST_UPDATED_DATETIME AS DATE) BETWEEN '{from_date}' AND '{to_date}'"
                )
            elif from_date:
                search_conditions.append(
                    f"CAST(k.LAST_UPDATED_DATETIME AS DATE) >= '{from_date}'"
                )
            elif to_date:
                search_conditions.append(
                    f"CAST(k.LAST_UPDATED_DATETIME AS DATE) <= '{to_date}'"
                )

        # Additional filters (matches CI3 lines 103-109)
        if request_data.get("STUDENT_ID"):
            student_id = request_data["STUDENT_ID"]
            search_conditions.append(
                f"(k.STUDENT_ID like '%{check_special_name(student_id)}%' OR lower(d.STUDENT_FULL_NAME) like'%{check_special_name(student_id.lower())}%')"
            )

        if request_data.get("BATCH_ID"):
            batch_id = request_data["BATCH_ID"]
            search_conditions.append(f"k.BATCH_ID like '%{check_special_name(batch_id)}%'")

        # Filter out empty conditions (matches CI3 line 172)
        search_conditions = [c for c in search_conditions if c.strip()]

        # Build final WHERE clause string (matches CI3 line 174)
        if len(search_conditions) > 0:
            return " AND ".join(search_conditions)
        else:
            return ""

    @staticmethod
    def format_error_reason(error_reason: Optional[str]) -> str:
        """
        Format error reason by splitting on numbering pattern
        Matches CI3 format (no special formatting, just return as-is for frontend to handle)
        """
        if not error_reason:
            return ""
        return error_reason

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """
        Map DataTable column name to SQL column for ORDER BY
        """
        order_map = {
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)",
            "INSTITUTION_ID": "k.INSTITUTION_ID",
            "STUDENT_ID": "k.STUDENT_ID",
            "STUDENT_FULL_NAME": "d.STUDENT_FULL_NAME",
            "BATCH_ID": "k.BATCH_ID",
            "STATUS_BANNER_ARTICULATION": "k.STATUS_BANNER_ARTICULATION",
            "LEVEL": "k.LEVEL",
            "ATTENDANCE_PERIOD": "k.ATTENDANCE_PERIOD",
            "TERM": "k.TERM",
            "SUBJECT": "k.SUBJECT",
            "COURSE_ID": "k.COURSE_ID",
            "COURSE_TITLE": "k.COURSE_TITLE",
            "CREDIT_HOURS_EARNED": "k.CREDIT_HOURS_EARNED",
            "GRADE": "k.GRADE",
            "ARTICULATION_STATUS_FLAG": "k.ARTICULATION_STATUS_FLAG",
            "ERROR_REASON": "k.ERROR_REASON",
            "LAST_UPDATED_DATETIME": "k.LAST_UPDATED_DATETIME",
            "UPDATED_BY": "k.UPDATED_BY",
        }
        return order_map.get(column_name, "k.LAST_UPDATED_DATETIME")

    @staticmethod
    def generate_transcript_pdf_url(transcript_link: str) -> str:
        """
        Generate PDF URL for transcript file with encryption
        Same as batchdetails_controller - returns encrypted URL ready for frontend
        """
        if not transcript_link or not str(transcript_link).strip():
            return ""
        
        from helpers.encryption_helper import get_encrypt_file_path
        
        # Encrypt the file path
        encrypted_path = get_encrypt_file_path(transcript_link)
        # Return the encrypted URL in the same format as batchdetails
        return f"/api/viewfile/transcript_file?pdf={encrypted_path}"

    @staticmethod
    def generate_transcript_pdf_url(transcript_link: str) -> str:
        """
        Generate PDF URL for transcript file with encryption
        Same as batchdetails_controller - returns encrypted URL ready for frontend
        """
        if not transcript_link or not str(transcript_link).strip():
            return ""
        
        from helpers.encryption_helper import get_encrypt_file_path
        
        # Encrypt the file path
        encrypted_path = get_encrypt_file_path(transcript_link)
        # Return the encrypted URL in the same format as batchdetails
        return f"/api/viewfile/transcript_file?pdf={encrypted_path}"

    @staticmethod
    def get_institution_name_for_000000(db: Session, batch_id: str) -> str:
        """
        Get institution name from TRANSCRIPTHDROCR table for INSTITUTION_ID = '000000'
        Matches CI3 getInstitution() function
        """
        try:
            query = text(f"""
                SELECT TOP 1 INSTITUTION_NAME
                FROM TRANSCRIPTHDROCR
                WHERE BATCH_ID = :batch_id
            """)
            result = db.execute(query, {"batch_id": batch_id}).fetchone()
            if result:
                return result[0] or ""
            return ""
        except Exception as e:
            logger.error(f"Error getting institution name for batch {batch_id}: {e}")
            return ""

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get articulation reports data for DataTables
        Matches CI3 Articulation_model::getreportsdata() method (lines 11-408)
        """
        print("=" * 80)
        print("[ArticulationReports] ====== START get_reports_data ======")
        print(f"[ArticulationReports] Request data keys: {list(request_data.keys())}")
        print(f"[ArticulationReports] Search_Field: {request_data.get('Search_Field', 'None')}")
        print("=" * 80)
        
        try:
            # Extract request parameters (matches CI3 lines 17-23)
            draw = int(request_data.get("draw", 1))
            start = int(request_data.get("start", 0))
            length = int(request_data.get("length", 10))
            
            print(f"[ArticulationReports] Params - draw: {draw}, start: {start}, length: {length}")
            
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
            print(f"[ArticulationReports] Building search conditions...")
            search_query = ArticulationReportsModel.build_search_conditions(request_data)
            print(f"[ArticulationReports] Search query: {search_query if search_query else 'None'}")

            # Build ORDER BY clause
            print(f"[ArticulationReports] Order - column_name: {column_name}, dir: {column_dir}")
            order_by_column = ArticulationReportsModel.get_order_by_column(column_name)
            order_by_clause = f"{order_by_column} {column_dir.upper()}"
            print(f"[ArticulationReports] Order by SQL: {order_by_clause}")

            # Phase_2 special condition (matches CI3 lines 186-192, 210-216)
            search_field = request_data.get("Search_Field", "")
            print(f"[ArticulationReports] Search_Field: '{search_field}'")
            
            phase_2_condition = ""
            if search_field == "Phase_2":
                phase_2_condition = """(UPPER(k.ERROR_REASON) LIKE '%AP COURSE — CSC TEAM TO REVIEW AND PROCESS MANUALLY%'
                              OR UPPER(k.ERROR_REASON) LIKE '%CLEP COURSE — CSC TEAM TO REVIEW AND PROCESS MANUALLY%')"""
                print("[ArticulationReports] Phase_2 condition: INCLUDE AP/CLEP courses")
            else:
                phase_2_condition = """(UPPER(k.ERROR_REASON) NOT LIKE '%AP COURSE — CSC TEAM TO REVIEW AND PROCESS MANUALLY%'
                              AND UPPER(k.ERROR_REASON) NOT LIKE '%CLEP COURSE — CSC TEAM TO REVIEW AND PROCESS MANUALLY%')"""
                print("[ArticulationReports] Phase_2 condition: EXCLUDE AP/CLEP courses")

            # Count total records (matches CI3 lines 182-198)
            # Build WHERE clause properly
            where_clauses = [phase_2_condition]
            if search_query:
                where_clauses.append(search_query)
            
            where_clause = " AND ".join(where_clauses)
            print(f"[ArticulationReports] WHERE clause: {where_clause}")
            
            count_query_sql = f"""
                SELECT count(*) as allcount
                FROM {TBL_ARTICULATION} as k WITH(NOLOCK)
                INNER JOIN {TBL_KICKOUT} as d WITH(NOLOCK) ON k.BATCH_ID = d.BATCH_ID
                WHERE {where_clause}
            """
            count_query = text(count_query_sql)
            
            print("=" * 80)
            print("[ArticulationReports] COUNT QUERY:")
            print(count_query_sql)
            print("=" * 80)

            try:
                print("[ArticulationReports] Executing count query...")
                count_result = db.execute(count_query).fetchone()
                print(f"[ArticulationReports] Count result type: {type(count_result)}")
                print(f"[ArticulationReports] Count result: {count_result}")
                
                # Access result properly (matches transcript reports model)
                if count_result:
                    # Try accessing as attribute first, then fallback to index
                    try:
                        total_records = count_result.allcount
                        print(f"[ArticulationReports] Got count from .allcount: {total_records}")
                    except AttributeError:
                        total_records = count_result[0] if count_result else 0
                        print(f"[ArticulationReports] Got count from index [0]: {total_records}")
                else:
                    total_records = 0
                    print("[ArticulationReports] No count result, setting to 0")
                
                records_filtered = total_records
                print(f"[ArticulationReports] Total records: {total_records}, Records filtered: {records_filtered}")
                logger.info(f"Count query executed successfully. Total records: {total_records}")
            except Exception as e:
                print(f"[ArticulationReports] ERROR in count query: {str(e)}")
                import traceback
                print(traceback.format_exc())
                logger.error(f"Error executing count query: {e}")
                logger.error(f"Count query: {count_query}")
                logger.error(traceback.format_exc())
                raise

            # Build data query (matches CI3 lines 202-223)
            # NOTE: EQV_COURSE_TITLE removed - column doesn't exist in database
            columns_list = f"""k.Id,k.SUBJECT,k.COURSE_ID,k.COURSE_TITLE,k.CREDIT_HOURS_EARNED,k.GRADE,k.BATCH_ID,k.INSTITUTION_ID,k.STUDENT_ID,
                      k.STATUS_BANNER_ARTICULATION,k.LEVEL,k.ATTENDANCE_PERIOD,k.TERM,k.ERROR_REASON,k.ERROR_SCREENSHOT,k.TRANSCRIPT_LINK,k.ARTICULATION_STATUS_FLAG,
                      k.LAST_UPDATED_DATETIME,k.UPDATED_BY,k.USER_COMMENTS,k.TRANSFER_DUPLICATE,k.ARTICULATION_INDICATOR,k.EQV_SUBJECT,d.STUDENT_FULL_NAME,
                      k.EQV_COURSE_ID,k.EQV_CREDIT_HOURS_EARNED,k.EQV_GRADE,k.INCLUDE_EXCLUDE,k.EQV_REPEAT_SYSTEM,k.EQV_COUNT_IN_GPA,
                      k.COURSE_ATTRIBUTE,k.IS_COMMENT_EDITED,(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID) AS INSTITUTION_NAME"""

            # Build WHERE clause for data query
            where_clauses_data = [phase_2_condition]
            if search_query:
                where_clauses_data.append(search_query)
            
            where_clause_data = " AND ".join(where_clauses_data)
            
            data_query_sql = f"""
                SELECT {columns_list}
                FROM {TBL_ARTICULATION} as k WITH(NOLOCK)
                INNER JOIN {TBL_KICKOUT} as d WITH(NOLOCK) ON k.BATCH_ID = d.BATCH_ID
                WHERE {where_clause_data}
                ORDER BY {order_by_clause}
                OFFSET {start} ROWS
                FETCH NEXT {length} ROWS ONLY
            """
            data_query = text(data_query_sql)
            
            print("=" * 80)
            print("[ArticulationReports] DATA QUERY:")
            print(data_query_sql)
            print("=" * 80)
            print(f"[ArticulationReports] Query params - start: {start}, length: {length}")

            try:
                print("[ArticulationReports] Executing data query...")
                records = db.execute(data_query).fetchall()
                print(f"[ArticulationReports] Data query returned {len(records)} rows")
                if len(records) > 0:
                    print(f"[ArticulationReports] First record keys: {list(dict(records[0]._mapping).keys())[:5]}...")
                logger.info(f"Data query executed successfully. Records returned: {len(records)}")
            except Exception as e:
                print(f"[ArticulationReports] ERROR in data query: {str(e)}")
                import traceback
                print(traceback.format_exc())
                logger.error(f"Error executing data query: {e}")
                logger.error(f"Data query: {data_query_sql}")
                logger.error(traceback.format_exc())
                raise

            # Format data (matches CI3 lines 226-397)
            print(f"[ArticulationReports] Formatting {len(records)} records...")
            data = []

            for idx, record in enumerate(records):
                if idx < 3:  # Log first 3 records for debugging
                    print(f"[ArticulationReports] Record {idx}: BATCH_ID={dict(record._mapping).get('BATCH_ID', 'N/A')}, STUDENT_ID={dict(record._mapping).get('STUDENT_ID', 'N/A')}")
                record_dict = dict(record._mapping)
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")
                institution_id = record_dict.get("INSTITUTION_ID", "")
                transcript_link = record_dict.get("TRANSCRIPT_LINK", "")
                error_screenshot = record_dict.get("ERROR_SCREENSHOT", "")
                user_comments = record_dict.get("USER_COMMENTS", "")
                articulation_status_flag = record_dict.get("ARTICULATION_STATUS_FLAG", "")
                eqv_credit_hours = record_dict.get("EQV_CREDIT_HOURS_EARNED", "")
                eqv_grade = record_dict.get("EQV_GRADE", "")
                credit_hours = record_dict.get("CREDIT_HOURS_EARNED", "")
                grade = record_dict.get("GRADE", "")

                # Format INSTITUTION_NAME (matches CI3 lines 260-264)
                institution_name = record_dict.get("INSTITUTION_NAME", "")
                if institution_id == "000000":
                    institution_name = ArticulationReportsModel.get_institution_name_for_000000(db, batch_id)
                    institution_name_formatted = institution_name.lower() if institution_name else ""
                else:
                    institution_name_formatted = institution_name.lower() if institution_name else ""

                # Format INSTITUTION_ID (matches CI3 lines 356-360)
                inst_id = institution_id if institution_id else ""

                # Credit hours and grade logic (matches CI3 lines 265-277)
                if not eqv_credit_hours:
                    credit_par_hours = credit_hours
                else:
                    credit_par_hours = eqv_credit_hours

                if not eqv_grade:
                    grade_equ = grade
                else:
                    grade_equ = eqv_grade

                # Build data row with raw data - frontend will handle HTML rendering
                data_row = {
                    "Id": record_dict.get("Id"),
                    "INSTITUTION_ID": inst_id,
                    "INSTITUTION_NAME": institution_name_formatted,
                    "STUDENT_ID": student_id,
                    "STUDENT_FULL_NAME": record_dict.get("STUDENT_FULL_NAME", ""),
                    "BATCH_ID": batch_id,
                    "STATUS_BANNER_ARTICULATION": record_dict.get("STATUS_BANNER_ARTICULATION", ""),
                    "SUBJECT": record_dict.get("SUBJECT", ""),
                    "COURSE_ID": record_dict.get("COURSE_ID", ""),
                    "COURSE_TITLE": record_dict.get("COURSE_TITLE", ""),
                    "TRANSFER_DUPLICATE": record_dict.get("TRANSFER_DUPLICATE", ""),
                    "ARTICULATION_INDICATOR": record_dict.get("ARTICULATION_INDICATOR", ""),
                    "EQV_SUBJECT": record_dict.get("EQV_SUBJECT", ""),
                    "EQV_COURSE_ID": record_dict.get("EQV_COURSE_ID", ""),
                    "EQV_CREDIT_HOURS_EARNED": credit_par_hours,
                    "EQV_GRADE": grade_equ,
                    "INCLUDE_EXCLUDE": record_dict.get("INCLUDE_EXCLUDE", ""),
                    "EQV_REPEAT_SYSTEM": record_dict.get("EQV_REPEAT_SYSTEM", ""),
                    "EQV_COUNT_IN_GPA": record_dict.get("EQV_COUNT_IN_GPA", ""),
                    "COURSE_ATTRIBUTE": record_dict.get("COURSE_ATTRIBUTE", ""),
                    "LEVEL": record_dict.get("LEVEL", ""),
                    "ATTENDANCE_PERIOD": record_dict.get("ATTENDANCE_PERIOD", ""),
                    "TERM": record_dict.get("TERM", ""),
                    "ERROR_REASON": ArticulationReportsModel.format_error_reason(record_dict.get("ERROR_REASON", "")),
                    "ERROR_SCREENSHOT": error_screenshot,
                    # TRANSCRIPT_LINK: Generate encrypted URL if transcript_link exists (same as batchdetails)
                    "TRANSCRIPT_LINK": ArticulationReportsModel.generate_transcript_pdf_url(transcript_link) if (transcript_link and str(transcript_link).strip()) else "",
                    "USER_COMMENTS": user_comments,
                    "CREDIT_HOURS_EARNED": credit_hours,
                    "GRADE": grade,
                    "ARTICULATION_STATUS_FLAG": articulation_status_flag,
                    "LAST_UPDATED_DATETIME": str(record_dict.get("LAST_UPDATED_DATETIME", "")) if record_dict.get("LAST_UPDATED_DATETIME") else "",
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
                    # Metadata for frontend rendering decisions
                    "_search_field": search_field,
                    "_has_update_permission": has_update_permission,
                    "_is_comment_edited": bool(record_dict.get("IS_COMMENT_EDITED", 0)),
                }

                data.append(data_row)

            # Return DataTables response
            # Frontend DataTable expects recordsTotal, recordsFiltered, data (standard DataTables format)
            # Include queries in response for debugging
            print(f"[ArticulationReports] Returning response - draw: {draw}, recordsTotal: {total_records}, recordsFiltered: {records_filtered}, data rows: {len(data)}")
            print("=" * 80)
            print("[ArticulationReports] ====== END get_reports_data ======")
            print("=" * 80)
            
            response = {
                "draw": int(draw),
                "recordsTotal": total_records,
                "recordsFiltered": records_filtered,
                "data": data,
                # Debug info - queries for testing
                "_debug": {
                    "count_query": count_query_sql,
                    "data_query": data_query_sql,
                    "search_query": search_query,
                    "where_clause": where_clause,
                    "where_clause_data": where_clause_data,
                    "phase_2_condition": phase_2_condition,
                    "order_by_clause": order_by_clause,
                    "search_field": search_field,
                    "start": start,
                    "length": length,
                    "column_name": column_name,
                    "column_dir": column_dir,
                    "total_records": total_records,
                    "records_returned": len(records),
                    "data_rows": len(data),
                }
            }
            
            return response

        except Exception as e:
            print(f"[ArticulationReports] FATAL ERROR in get_reports_data: {str(e)}")
            import traceback
            print(traceback.format_exc())
            logger.exception("Error in get_reports_data")
            raise

