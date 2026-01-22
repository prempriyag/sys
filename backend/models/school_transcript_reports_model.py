"""
Transcript Reports Model
Contains all query logic for transcript reports
Based on CI3 Transcripts_model.php getreportsdata() method
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, Dict, List, Any
import logging
import re
from datetime import datetime

from config.constants import (
    TBL_KICKOUT,
    TBL_TRANSCRIPTHDRDATA,
    TBL_DOWNLOAD,
    TBL_INSTITUTION_MAPPING,
    SCHOOL_PROJECT_ID,
)
from helpers.common_helper import check_special_name, ymd_date_format

logger = logging.getLogger(__name__)


class SchoolTranscriptReportsModel:
    """Model for transcript reports queries"""

    @staticmethod
    def build_search_conditions(
        request_data: Dict[str, Any]
    ) -> str:
        """
        Build search conditions from request data as raw SQL string
        Matches CI3 getreportsdata() search logic exactly
        Returns: SQL WHERE clause string (without WHERE keyword)
        """
        search_conditions = []
        search_value = request_data.get("search", {}).get("value", "")

        # Global search (matches CI3 lines 368-390)
        if search_value:
            search_safe = check_special_name(search_value)
            search_lower = check_special_name(search_value.lower())

            search_conditions.append(f"""( k.BATCH_ID like '%{search_safe}%' or
                k.INSTITUTION_ID like '%{search_safe}%' or 
                lower(d.SOURCE_TYPE) like'%{search_lower}%' or
                lower(k.STUDENT_ID) like '%{search_lower}%' or 
                lower((SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)) LIKE '%{search_lower}%' or
                lower(k.STUDENT_FULL_NAME) like '%{search_lower}%' or 
                lower(k.STATUS_SAAADMS) like '%{search_lower}%' or 
                lower(k.STATUS_SOAPCOL) like '%{search_lower}%' or 
                lower(k.STATUS_SHATAEQ) like '%{search_lower}%' or 
                lower(k.STATUS_SPACMNT) like '%{search_lower}%' or 
                lower(k.STATUS_BDMS) like'%{search_lower}%' or 
                lower(k.ERROR_REASON) like'%{search_lower}%' or  
                lower(k.USER_COMMENTS) like'%{search_lower}%' or
                lower(k.COMMENTS) like'%{search_lower}%' or  
                lower(k.TRANSCRIPT_STATUS_FLAG) like'%{search_lower}%' or
                lower(k.ARTICULATION_STATUS_FLAG) like'%{search_lower}%' or
                k.LAST_UPDATED_DATETIME like'%{search_safe}%' or 
                lower(k.UPDATED_BY) like'%{search_lower}%') """)

        # Search_Field filters (matches CI3 lines 393-429)
        search_field = request_data.get("Search_Field", "")

        if search_field == "Processed":
            search_conditions.append(
                "(UPPER(k.TRANSCRIPT_STATUS_FLAG) LIKE 'PROCESSED' "
                "OR UPPER(k.TRANSCRIPT_STATUS_FLAG) LIKE 'PROCESSED MANUALLY BY OSU-CSC' "
                "OR UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'DUPLICATE' "
                "OR UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'NO ACTION NEEDED')"
            )
        elif search_field == "Partially-Processed":
            search_conditions.append("k.TRANSCRIPT_STATUS_FLAG = 'PARTIALLY PROCESSED'")
        elif search_field == "Failed":
            search_conditions.append("UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'FAILED'")
        elif search_field == "Rerun":
            search_conditions.append(
                "(UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'RERUN' "
                "OR UPPER(k.ARTICULATION_STATUS_FLAG) = 'RERUN')"
            )
        elif search_field == "equivalenthours":
            search_conditions.append(
                "(UPPER(k.ERROR_REASON) LIKE '%EQUIVALENT ROLL HOURS DO NOT MATCH. PLEASE REVIEW%' "
                "AND UPPER(k.ARTICULATION_STATUS_FLAG) = 'PROCESSED' "
                "AND k.UPDATED_BY = 'Articulation BOT')"
            )
        elif search_field == "To-Be-Reviewed":
            search_conditions.append(
                "(k.TRANSCRIPT_STATUS_FLAG = 'NO PROCESSING NEEDED' "
                "OR k.TRANSCRIPT_STATUS_FLAG = 'OSU TRANSCRIPT' "
                "OR k.TRANSCRIPT_STATUS_FLAG = 'DUPLICATE')"
            )
        elif search_field == "OSU-ID-Not-Found":
            search_conditions.append(
                "((LOWER(k.ERROR_REASON) LIKE '%error when searching student in banner%' "
                "OR LOWER(k.ERROR_REASON) LIKE '%not enough parameters to search valid student%') "
                "AND k.TRANSCRIPT_STATUS_FLAG = 'FAILED')"
            )
        elif search_field == "Degree-Mapping-Errors":
            search_conditions.append(
                "((LOWER(k.ERROR_REASON) LIKE '%degree%') "
                "AND k.TRANSCRIPT_STATUS_FLAG = 'FAILED')"
            )
        elif search_field == "Not-a-transcript":
            search_conditions.append(
                "((LOWER(k.ERROR_REASON) LIKE '%not a transcript%' "
                "OR UPPER(k.ERROR_REASON) LIKE '%NOT A HIGHSCHOOL TRANSCRIPT%') "
                "AND k.TRANSCRIPT_STATUS_FLAG = 'FAILED')"
            )
        elif search_field == "Term-ID-Not-Found":
            search_conditions.append(
                "((LOWER(k.ERROR_REASON) LIKE '%error while entering details into saaadms%') "
                "AND k.TRANSCRIPT_STATUS_FLAG = 'FAILED')"
            )
        elif search_field == "Articulation-Kickouts":
            search_conditions.append(
                "(UPPER(k.TRANSCRIPT_STATUS_FLAG) = 'PROCESSED' "
                "AND (UPPER(k.ARTICULATION_STATUS_FLAG) = 'FAILED' "
                "OR UPPER(k.ARTICULATION_STATUS_FLAG) = 'PARTIALLY PROCESSED'))"
            )

        # Field type filters (matches CI3 lines 431-588)
        field_type = request_data.get("fieldType")
        field_name = request_data.get("fieldName")

        if field_type and field_name:
            if field_type == "COLLEGE_ID":
                search_conditions.append(f"k.INSTITUTION_ID = '{check_special_name(field_name)}'")
            elif field_type == "SOURCE_TYPE":
                search_conditions.append(f"d.SOURCE_TYPE = '{check_special_name(field_name)}'")
            elif field_type == "COLLEGE_NAME":
                search_conditions.append(f"k.INSTITUTION_ID = '{check_special_name(field_name)}'")
            elif field_type == "STUDENT_FULL_NAME":
                search_conditions.append(
                    f"UPPER(k.STUDENT_FULL_NAME) like '%{check_special_name(field_name.upper())}%'"
                )
            elif field_type == "STUDENT_ID":
                search_conditions.append(
                    f"UPPER(k.STUDENT_ID) like '%{field_name.upper()}%'"
                )
            elif field_type == "BATCH_ID":
                search_conditions.append(f"k.BATCH_ID like '%{check_special_name(field_name)}%'")
            elif field_type == "ERROR_REASON":
                search_conditions.append(
                    f"lower(k.ERROR_REASON) like '%{field_name.lower()}%'"
                )
            elif field_type == "USER_COMMENTS":
                search_conditions.append(
                    f"lower(k.USER_COMMENTS) like '%{field_name.lower()}%'"
                )
            elif field_type == "COMMENTS":
                search_conditions.append(
                    f"lower(k.COMMENTS) like '%{field_name.lower()}%'"
                )
            elif field_type == "STATUS_SAAADMS":
                search_conditions.append(f"k.STATUS_SAAADMS = '{check_special_name(field_name)}'")
            elif field_type == "STATUS_SOAPCOL":
                search_conditions.append(f"k.STATUS_SOAPCOL = '{check_special_name(field_name)}'")
            elif field_type == "STATUS_SHATAEQ":
                search_conditions.append(f"k.STATUS_SHATAEQ = '{check_special_name(field_name)}'")
            elif field_type == "STATUS_SPACMNT":
                search_conditions.append(f"k.STATUS_SPACMNT = '{check_special_name(field_name)}'")
            elif field_type == "STATUS_BDMS":
                search_conditions.append(f"k.STATUS_BDMS = '{check_special_name(field_name)}'")
            elif field_type == "TRANSCRIPT_STATUS_FLAG":
                search_conditions.append(f"k.TRANSCRIPT_STATUS_FLAG = '{check_special_name(field_name)}'")
            elif field_type == "ARTICULATION_STATUS_FLAG":
                search_conditions.append(
                    f"k.ARTICULATION_STATUS_FLAG = '{check_special_name(field_name)}'"
                )
            elif field_type == "UPDATED_BY":
                if field_name == "others":
                    search_conditions.append(
                        "k.UPDATED_BY != 'Transcript BOT' AND k.UPDATED_BY != 'Articulation BOT'"
                    )
                else:
                    search_conditions.append(f"k.UPDATED_BY = '{check_special_name(field_name)}'")
            elif field_type == "OCR_EXTRACTED_DATE":
                from_date = request_data.get("fromDate")
                to_date = request_data.get("toDate")
                if from_date and to_date:
                    search_conditions.append(
                        f"CAST(h.OCR_EXTRACTED_DATE AS DATE) BETWEEN '{ymd_date_format(from_date)}' AND '{ymd_date_format(to_date)}'"
                    )
                elif from_date:
                    search_conditions.append(
                        f"CAST(h.OCR_EXTRACTED_DATE AS DATE) >= '{ymd_date_format(from_date)}'"
                    )
                elif to_date:
                    search_conditions.append(
                        f"CAST(h.OCR_EXTRACTED_DATE AS DATE) <= '{ymd_date_format(to_date)}'"
                    )
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

        # Additional filters (matches CI3 lines 461-467)
        if request_data.get("STUDENT_ID"):
            student_id = request_data["STUDENT_ID"]
            search_conditions.append(
                f"(k.STUDENT_ID like '%{check_special_name(student_id)}%' OR lower(k.STUDENT_FULL_NAME) like'%{check_special_name(student_id.lower())}%')"
            )

        if request_data.get("BATCH_ID"):
            batch_id = request_data["BATCH_ID"]
            search_conditions.append(f"k.BATCH_ID like '%{check_special_name(batch_id)}%'")

        # Filter out empty conditions (matches CI3 line 590)
        search_conditions = [c for c in search_conditions if c.strip()]

        # Build final WHERE clause string (matches CI3 line 592)
        if len(search_conditions) > 0:
            return " AND ".join(search_conditions)
        else:
            return ""

    @staticmethod
    def get_order_by_column(column_name: str) -> str:
        """
        Map DataTable column name to SQL column for ORDER BY
        Matches CI3 order_by logic
        """
        order_map = {
            "INSTITUTION_NAME": f"(SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID)",
            "INSTITUTION_ID": "k.INSTITUTION_ID",
            "STUDENT_ID": "k.STUDENT_ID",
            "STUDENT_FULL_NAME": "k.STUDENT_FULL_NAME",
            "BATCH_ID": "k.BATCH_ID",
            "STATUS_BANNER": "k.STATUS_SOAPCOL",
            "STATUS_BDMS": "k.STATUS_BDMS",
            "TRANSCRIPT_STATUS_FLAG": "k.TRANSCRIPT_STATUS_FLAG",
            "ARTICULATION_STATUS_FLAG": "k.ARTICULATION_STATUS_FLAG",
            "ERROR_REASON": "k.ERROR_REASON",
            "LAST_UPDATED_DATETIME": "k.LAST_UPDATED_DATETIME",
            "UPDATED_BY": "k.UPDATED_BY",
            "PROCESS_STATUS": "k.PROCESS_STATUS",
        }
        return order_map.get(column_name, "k.LAST_UPDATED_DATETIME")

    @staticmethod
    def format_error_reason(error_reason: Optional[str]) -> str:
        """
        Format error reason by splitting on numbering pattern
        Matches CI3 line 824-825
        """
        if not error_reason:
            return ""

        # Split on pattern like "1).", "2).", etc.
        parts = re.split(r"(?=\d+\)\.\s)", error_reason.strip())
        # Filter out empty parts and join with <br>
        parts = [p.strip() for p in parts if p.strip()]
        return "<br>".join(parts)

    @staticmethod
    def calculate_status_banner(record: Dict[str, Any]) -> str:
        """
        Calculate STATUS_BANNER based on various status fields
        Matches CI3 lines 784-790
        """
        status_soapcol = record.get("STATUS_SOAPCOL", "")
        status_saaadms = record.get("STATUS_SAAADMS", "")
        status_bdms = record.get("STATUS_BDMS", "")
        status_spacmnt = record.get("STATUS_SPACMNT", "")
        status_soahold = record.get("STATUS_SOAHOLD", "")

        if (
            status_soapcol == "Failed"
            or status_saaadms == "Failed"
            or status_bdms == "Failed"
            or status_spacmnt == "Failed"
            or status_soahold == "Failed"
        ):
            return "Failed"
        elif (
            status_soapcol == "Processed"
            and status_saaadms == "Processed"
            and status_bdms == "Processed"
            and status_spacmnt == "Processed"
            and status_soahold == "Processed"
        ) or (
            status_soapcol == "Processed"
            and status_saaadms == "Processed"
            and status_bdms == "Processed"
        ):
            return "Processed"
        else:
            return ""

    @staticmethod
    def format_date(date_value: Any) -> str:
        """Format date value for display"""
        if not date_value:
            return ""
        if isinstance(date_value, datetime):
            return date_value.strftime("%Y-%m-%d")
        return str(date_value)

    @staticmethod
    def get_institution_name_for_000000(db: Session, batch_id: str) -> str:
        """
        Get institution name for INSTITUTION_ID = '000000'
        Matches CI3 getInstitution() helper function
        """
        try:
            from config.constants import TBL_TRANSCRIPTHDROCR
            sql = f"SELECT TOP 1 EXTERNAL_INSTITUTION_NAME FROM {TBL_TRANSCRIPTHDROCR} WHERE BATCH_ID = :batch_id"
            result = db.execute(text(sql), {"batch_id": batch_id}).fetchone()
            if result:
                return result.EXTERNAL_INSTITUTION_NAME or ""
            return ""
        except Exception as e:
            logger.error(f"Error getting institution name for batch {batch_id}: {str(e)}")
            return ""

    @staticmethod
    def generate_transcript_pdf_url(transcript_link: str, base_url: str = "") -> str:
        """
        Generate PDF URL for transcript file with encryption
        Same as batchdetails_controller - returns encrypted URL ready for frontend
        Matches CI3: SESSION_PATH . 'transcript_file?pdf=' . getencryptfilepath($record->TRANSCRIPT_LINK)
        """
        if not transcript_link or not str(transcript_link).strip():
            return ""
        
        from helpers.encryption_helper import get_encrypt_file_path
        
        # Encrypt the file path
        encrypted_path = get_encrypt_file_path(transcript_link)
        # Return the encrypted URL in the same format as batchdetails (without base_url for consistency)
        return f"/api/viewfile/transcript_file?pdf={encrypted_path}"

    @staticmethod
    def generate_articulation_pdf_url(transfer_letter_link: str, base_url: str = "") -> str:
        """
        Generate PDF URL for articulation/transfer letter file with encryption
        Matches CI3: SESSION_PATH . 'transcript_file?pdf=' . getencryptfilepath($record->TRANSFER_LETTER_FILE_LINK)
        """
        if not transfer_letter_link:
            return ""
        
        from helpers.encryption_helper import get_encrypt_file_path
        
        # Encrypt the file path
        encrypted_path = get_encrypt_file_path(transfer_letter_link)
        return f"{base_url}/api/viewfile/transcript_file?pdf={encrypted_path}"

    @staticmethod
    def generate_error_screenshot_html(error_screenshot: str, batch_id: str, base_url: str = "") -> str:
        """
        Generate HTML for error screenshot link
        Matches CI3 lines 684-690
        """
        if not error_screenshot:
            return ""
        image_url = f"{base_url}/api/viewfile/errorscreenshot/{batch_id}"
        return f'<a href="{image_url}" target="_blank" rel="noopener noreferrer"><span class="fa fa-eye"></span></a>'

    @staticmethod
    def generate_transcript_link_html(transcript_link: str, base_url: str = "") -> str:
        """
        Generate HTML for transcript link
        Matches CI3 lines 692-693
        """
        if not transcript_link:
            return ""
        pdf_url = SchoolTranscriptReportsModel.generate_transcript_pdf_url(transcript_link, base_url)
        return f'<a href="{pdf_url}" target="_blank" rel="noopener noreferrer"><span class="fa fa-link"></span></a>'

    @staticmethod
    def generate_transfer_letter_link_html(transfer_letter_link: str, base_url: str = "") -> str:
        """
        Generate HTML for transfer letter file link
        Matches CI3 lines 695-698
        """
        if not transfer_letter_link:
            return ""
        pdf_url = SchoolTranscriptReportsModel.generate_articulation_pdf_url(transfer_letter_link, base_url)
        return f'<a href="{pdf_url}" target="_blank" rel="noopener noreferrer"><span class="fa fa-link"></span></a>'

    @staticmethod
    def generate_batch_id_html(batch_id: str, base_url: str = "") -> str:
        """
        Generate HTML for Batch ID with copy icon and link
        Matches CI3 line 703
        """
        if not batch_id:
            return ""
        view_url = f"{base_url}batchdetails/{batch_id}"
        return f'<span class="copyinstid" id="{batch_id}"><i class="btn-copy-icon fa-duotone fa-paste me-1"></i></span><a href="{view_url}" target="_blank">{batch_id}</a><input type="hidden" class="record_batch_id" value="{batch_id}"/>'

    @staticmethod
    def generate_student_id_html(
        student_id: str,
        batch_id: str,
        search_field: str,
        has_update_permission: bool,
        base_url: str = ""
    ) -> str:
        """
        Generate HTML for Student ID with conditional formatting
        Matches CI3 lines 705-719
        """
        if not student_id:
            return ""
        
        copy_icon = f'<span class="copyinstid" id="{student_id}"><i class="btn-copy-icon fa-duotone fa-paste me-1"></i></span>'
        
        if search_field in ["Articulation-Kickouts", "Processed", ""]:
            # Simple link format
            if student_id:
                student_view_url = f"{base_url}studentview?student_id={student_id}"
                return f'{copy_icon}<a href="{student_view_url}" target="_blank">{student_id}</a>'
            else:
                return f'{copy_icon}<span>{student_id}</span>'
        else:
            # Conditional edit format for Failed/Rerun
            if student_id and has_update_permission and search_field in ["Failed", "Rerun"]:
                student_view_url = f"{base_url}studentview?student_id={student_id}"
                return f'{copy_icon}<span class="studentid_edit" id="{batch_id}" osuid="{student_id}" title="Edit Student ID"></span><a href="{student_view_url}" target="_blank" title="View Student Details"><span class="student-id-text" id="student-id-{student_id}">{student_id}</span></a>'
            else:
                return f'{copy_icon}<span>{student_id}</span>'

    @staticmethod
    def generate_slate_ref_number_html(
        slate_ref_number: str,
        batch_id: str,
        search_field: str,
        has_update_permission: bool
    ) -> str:
        """
        Generate HTML for Slate Reference Number with conditional formatting
        Matches CI3 lines 807-819
        """
        if not slate_ref_number:
            return ""
        
        copy_icon = f'<span class="copyinstid" id="{slate_ref_number}"><i class="btn-copy-icon fa-duotone fa-paste me-1"></i></span>'
        
        if search_field in ["Articulation-Kickouts", "Processed", ""]:
            # Simple format
            return f'{copy_icon}<span class="student-id-text">{slate_ref_number}</span>'
        else:
            # Conditional edit format for Failed/Rerun
            if slate_ref_number and has_update_permission and search_field in ["Failed", "Rerun"]:
                return f'{copy_icon}<span class="slateid_edit" id="{batch_id}" slateid="{slate_ref_number}" title="Edit Student Slate ID"> {slate_ref_number}</span>'
            else:
                return f'{copy_icon}<span>{slate_ref_number}</span>'

    @staticmethod
    def generate_institution_id_html(institution_id: str) -> str:
        """
        Generate HTML for Institution ID with copy icon
        Matches CI3 lines 792-798
        """
        if institution_id == "NONE":
            return institution_id
        elif institution_id:
            return f'<span class="copyinstid" id="{institution_id}"><i class="btn-copy-icon fa-duotone fa-paste me-1"></i>{institution_id}</span>'
        else:
            return ""

    @staticmethod
    def generate_user_comments_html(user_comments: str, batch_id: str, search_field: str) -> str:
        """
        Generate HTML for user comments (textarea or plain text)
        Matches CI3 lines 721, 761-767
        """
        if search_field in ["Processed", "equivalenthours"]:
            # Return plain text
            return user_comments or ""
        else:
            # Return textarea HTML
            return f'<textarea disabled name="usercomment" type="text" id="{batch_id}" class="usercomment">{user_comments or ""}</textarea>'

    @staticmethod
    def generate_action_dropdown_html(
        batch_id: str,
        search_field: str,
        articulation_status_flag: str,
        has_update_permission: bool
    ) -> str:
        """
        Generate HTML for action dropdown
        Matches CI3 lines 723-752
        """
        if not has_update_permission:
            return ""
        
        if search_field == "Articulation-Kickouts":
            if articulation_status_flag == "Failed":
                return f'''<select class="form-select articulationreprocess slddrb" id="{batch_id}" name="articulationreprocess">
            <option value="0">Action Needed</option>
            <option value="Noaction">No Action Needed</option>
            <option value="Rerun">Reprocess this Transcript</option>
            <option value="Processed">Processed Manually by OSU-CSC</option>
            </select>'''
            else:
                return ""
        else:
            return f'''<select class="form-select transcriptreprocess slddrb" id="{batch_id}" name="transcriptreprocess">
            <option value="0">Action Needed</option>
            <option value="Noaction">No Action Needed</option>
            <option value="Rerun" data-type="Rerun">Reprocess this Transcript</option>
            <option value="Rerun" data-type="Rerun15">Reprocess for 30 days</option>
            <option value="Processed" data-type="Processed">Processed Manually by OSU-CSC</option>
            </select>'''

    @staticmethod
    def get_reports_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get transcript reports data
        Main method matching CI3 getreportsdata()
        """
        try:
            # Log incoming request for debugging
            print(f"[TranscriptReports] ========== START get_reports_data ==========")
            print(f"[TranscriptReports] Search_Field: {request_data.get('Search_Field', 'None')}")
            print(f"[TranscriptReports] Request keys: {list(request_data.keys())}")
            
            # First, test if we can query the table at all
            # Include NULL PROJECT_ID like dashboard does for school data
            test_sql = f"SELECT COUNT(*) as test_count FROM {TBL_KICKOUT} WITH(NOLOCK) WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID} OR PROJECT_ID IS NULL)"
            try:
                test_result = db.execute(text(test_sql)).fetchone()
                test_count = test_result.test_count if test_result else 0
                print(f"[TranscriptReports] TEST: Total records with PROJECT_ID={SCHOOL_PROJECT_ID}: {test_count}")
            except Exception as test_e:
                print(f"[TranscriptReports] TEST query failed: {str(test_e)}")
                import traceback
                traceback.print_exc()
                # Continue anyway, might be a different issue
            
            draw = request_data.get("draw", 1)
            start = request_data.get("start", 0)
            rowperpage = request_data.get("length", 10)
            column_index = (
                request_data.get("order", [{}])[0].get("column", 0)
                if request_data.get("order")
                else 0
            )
            column_name = (
                request_data.get("columns", [{}])[column_index].get("data", "LAST_UPDATED_DATETIME")
                if request_data.get("columns")
                else "LAST_UPDATED_DATETIME"
            )
            column_sort_order = (
                request_data.get("order", [{}])[0].get("dir", "desc")
                if request_data.get("order")
                else "desc"
            )

            # Build search conditions (raw SQL string like CI3)
            search_query = SchoolTranscriptReportsModel.build_search_conditions(request_data)

            # Count query (matches CI3 lines 600-610)
            # Include NULL PROJECT_ID like dashboard does for school data
            count_sql = f"""
                SELECT count(*) as allcount
                FROM {TBL_KICKOUT} as k WITH(NOLOCK)
                INNER JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID=k.BATCH_ID
                INNER JOIN {TBL_DOWNLOAD} as d WITH(NOLOCK) ON d.BATCH_ID=k.BATCH_ID
                WHERE (k.PROJECT_ID = {SCHOOL_PROJECT_ID} OR k.PROJECT_ID IS NULL)
            """
            
            if search_query:
                count_sql += f" AND {search_query}"

            # Log the count query for debugging
            logger.info(f"[TranscriptReports] Count Query: {count_sql}")
            logger.info(f"[TranscriptReports] PROJECT_ID: {SCHOOL_PROJECT_ID}")
            logger.info(f"[TranscriptReports] Search Query: {search_query if search_query else 'None'}")

            try:
                count_result = db.execute(text(count_sql)).fetchone()
                total_records = count_result.allcount if count_result else 0
                total_recordswith_filter = total_records
                logger.info(f"[TranscriptReports] Count Result: {total_records} records")
            except Exception as e:
                logger.error(f"[TranscriptReports] Count Query Error: {str(e)}", exc_info=True)
                raise

            # Get order by column
            order_by = SchoolTranscriptReportsModel.get_order_by_column(column_name)

            # Data query (matches CI3 lines 617-673)
            # Build column list exactly as CI3
            columns_list = f"""k.BATCH_ID,
                      k.INSTITUTION_ID,
                      k.LETTER_SENT_DATE,
                      k.TRANSFER_LETTER_FILE_LINK,
                      k.STUDENT_ID,
                      k.STUDENT_FULL_NAME,
                      k.STATUS_SAAADMS,
                      k.STATUS_SOAPCOL,
                      k.STATUS_BDMS,
                      k.STATUS_SHATAEQ,
                      k.STATUS_SPACMNT,
                      k.SCENARIO,
                      k.COMMENTS,
                      k.ERROR_REASON,
                      k.ERROR_SCREENSHOT,
                      k.TRANSCRIPT_LINK,
                      k.TRANSCRIPT_STATUS_FLAG,
                      k.ARTICULATION_STATUS_FLAG,
                      k.STATUS_SOAHSCH,
                      k.STATUS_SOAHOLD,
                      k.LAST_UPDATED_DATETIME,
                      k.UPDATED_BY,
                      k.USER_COMMENTS,
                      k.PROCESS_STATUS,
                      h.STATE,
                      h.CITY,
                      h.ZIPCODE,
                      d.SOURCE_TYPE,
                      h.DATE_OF_BIRTH,
                      h.SSN,
                      h.STUDENT_FIRST_NAME,
                      h.STUDENT_LAST_NAME,
                      h.CGPA,
                      h.TOTAL_CREDITS_EARNED,
                      h.TOTAL_CREDITS_ATTENDED,
                      h.DEGREE_CD,
                      h.DEGREE_RECEIVED_DATE,
                      h.SECOND_DEGREE_CD,
                      h.SECOND_DEGREE_RECEIVED_DATE,
                      h.EXTERNAL_INSTITUTION_ZIPCODE,
                    (SELECT TOP 1 INSTITUTION_NAME FROM {TBL_INSTITUTION_MAPPING} as m WHERE m.INSTITUTION_ID = k.INSTITUTION_ID) AS INSTITUTION_NAME"""

            # Build data query exactly as CI3 (matches lines 662-673)
            # Include NULL PROJECT_ID like dashboard does for school data
            data_sql = f"""
                SELECT {columns_list}
                FROM {TBL_KICKOUT} as k WITH(NOLOCK)
                INNER JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID=k.BATCH_ID
                INNER JOIN {TBL_DOWNLOAD} as d WITH(NOLOCK) ON d.BATCH_ID=k.BATCH_ID
                WHERE (k.PROJECT_ID = {SCHOOL_PROJECT_ID} OR k.PROJECT_ID IS NULL)
            """
            
            if search_query:
                data_sql += f" AND {search_query}"
            
            # CI3 uses $columnName directly: $this->db->order_by($columnName, $columnSortOrder);
            # But in raw SQL, we need to map it to the actual SQL column
            # For INSTITUTION_NAME, we need the subquery; for others, use table prefix
            data_sql += f" ORDER BY {order_by} {column_sort_order}"
            data_sql += f" OFFSET {start} ROWS FETCH NEXT {rowperpage} ROWS ONLY"

            # Log the queries for debugging (matching CI3's echo $this->db->last_query())
            print("=" * 80)
            print("[TranscriptReports] COUNT QUERY:")
            print(count_sql)
            print("=" * 80)
            print("[TranscriptReports] DATA QUERY:")
            print(data_sql)
            print("=" * 80)
            print(f"[TranscriptReports] Request Params - draw: {draw}, start: {start}, length: {rowperpage}")
            print(f"[TranscriptReports] Order - column: {column_name} -> SQL: {order_by}, dir: {column_sort_order}")
            print(f"[TranscriptReports] Search_Field: {request_data.get('Search_Field', 'None')}")
            print(f"[TranscriptReports] Search Value: {request_data.get('search', {}).get('value', 'None')}")
            print("=" * 80)

            try:
                records = db.execute(text(data_sql)).fetchall()
                print(f"[TranscriptReports] Data Query returned {len(records)} rows")
            except Exception as e:
                print(f"[TranscriptReports] Data Query Error: {str(e)}")
                print(f"[TranscriptReports] Failed SQL: {data_sql}")
                import traceback
                traceback.print_exc()
                raise

            # Format data (matches CI3 lines 677-874)
            search_field = request_data.get("Search_Field", "")
            data = []

            for record in records:
                record_dict = dict(record._mapping)
                batch_id = record_dict.get("BATCH_ID", "")
                student_id = record_dict.get("STUDENT_ID", "")
                institution_id = record_dict.get("INSTITUTION_ID", "")
                transcript_link = record_dict.get("TRANSCRIPT_LINK", "")
                transfer_letter_link = record_dict.get("TRANSFER_LETTER_FILE_LINK", "")
                error_screenshot = record_dict.get("ERROR_SCREENSHOT", "")
                user_comments = record_dict.get("USER_COMMENTS", "")
                articulation_status_flag = record_dict.get("ARTICULATION_STATUS_FLAG", "")

                # Format ERROR_REASON (split on numbering pattern for frontend to handle)
                error_reason = SchoolTranscriptReportsModel.format_error_reason(
                    record_dict.get("ERROR_REASON")
                )

                # Calculate STATUS_BANNER (matches CI3 lines 784-790)
                status_banner = SchoolTranscriptReportsModel.calculate_status_banner(record_dict)

                # Format INSTITUTION_NAME (matches CI3 lines 755-759)
                institution_name = record_dict.get("INSTITUTION_NAME", "")
                if institution_id == "000000":
                    # Get institution name from TRANSCRIPTHDROCR table (matches CI3 getInstitution())
                    institution_name = SchoolTranscriptReportsModel.get_institution_name_for_000000(db, batch_id)
                    institution_name_formatted = institution_name.lower() if institution_name else ""
                else:
                    institution_name_formatted = institution_name.lower() if institution_name else ""

                # Format dates
                degree_received_date = SchoolTranscriptReportsModel.format_date(
                    record_dict.get("DEGREE_RECEIVED_DATE")
                )
                second_degree_received_date = SchoolTranscriptReportsModel.format_date(
                    record_dict.get("SECOND_DEGREE_RECEIVED_DATE")
                )

                # Build data row with raw data - frontend will handle HTML rendering
                # Include metadata flags for frontend to determine how to render
                data_row = {
                    # Raw values for frontend to format
                    "INSTITUTION_ID": institution_id,
                    "INSTITUTION_NAME": institution_name_formatted,
                    "STUDENT_ID": student_id,
                    "STUDENT_FULL_NAME": (
                        record_dict.get("STUDENT_FULL_NAME", "").lower()
                        if record_dict.get("STUDENT_FULL_NAME")
                        else ""
                    ),
                    "BATCH_ID": batch_id,
                    "STATUS_BANNER": status_banner,
                    "STATUS_SAAADMS": record_dict.get("STATUS_SAAADMS", ""),
                    "STATUS_SOAPCOL": record_dict.get("STATUS_SOAPCOL", ""),
                    "STATUS_BDMS": record_dict.get("STATUS_BDMS", ""),
                    "ERROR_REASON": error_reason,  # Already formatted with <br> tags
                    # ERROR_SCREENSHOT: Return raw value if exists (frontend will check and construct URL from batch_id)
                    # Matches CI3: if ($record->ERROR_SCREENSHOT != '' || !empty($record->ERROR_SCREENSHOT))
                    # Return the raw error_screenshot value (file path) if it exists, empty string if not
                    "ERROR_SCREENSHOT": error_screenshot if (error_screenshot and str(error_screenshot).strip()) else "",  # Raw value, frontend will check if not empty
                    # TRANSCRIPT_LINK: Always generate encrypted URL if transcript_link exists
                    # Matches CI3: $transcript_link .= '<a href="' . $pdfpath . '" target="_blank"><span class="fa fa-link"></span></a>';
                    # Note: CI3 always shows the link structure, but we only show if transcript_link exists
                    "TRANSCRIPT_LINK": SchoolTranscriptReportsModel.generate_transcript_pdf_url(transcript_link) if (transcript_link and str(transcript_link).strip()) else "",  # Encrypted URL or empty string
                    "STATUS_FLAG": record_dict.get("TRANSCRIPT_STATUS_FLAG", ""),
                    "ACTION": "",  # Frontend will generate dropdown based on permissions
                    "SCENARIO": (
                        record_dict.get("SCENARIO", "").lower()
                        if record_dict.get("SCENARIO")
                        else ""
                    ),
                    "COMMENTS": record_dict.get("COMMENTS", ""),
                    "USER_COMMENTS": user_comments,  # Raw value, frontend will generate textarea if needed
                    "LETTER_SENT_DATE": str(record_dict.get("LETTER_SENT_DATE", ""))
                    if record_dict.get("LETTER_SENT_DATE")
                    else "",
                    "TRANSFER_LETTER_FILE_LINK": SchoolTranscriptReportsModel.generate_articulation_pdf_url(transfer_letter_link) if transfer_letter_link else "",  # Encrypted URL
                    "SOURCE_TYPE": record_dict.get("SOURCE_TYPE", ""),
                    "LAST_UPDATED_DATETIME": str(record_dict.get("LAST_UPDATED_DATETIME", ""))
                    if record_dict.get("LAST_UPDATED_DATETIME")
                    else "",
                    "UPDATED_BY": record_dict.get("UPDATED_BY", ""),
                    "DATE_OF_BIRTH": str(record_dict.get("DATE_OF_BIRTH", ""))
                    if record_dict.get("DATE_OF_BIRTH")
                    else "",
                    "SSN": record_dict.get("SSN", ""),
                    "STUDENT_FIRST_NAME": record_dict.get("STUDENT_FIRST_NAME", ""),
                    "STUDENT_LAST_NAME": record_dict.get("STUDENT_LAST_NAME", ""),
                    "CGPA": str(record_dict.get("CGPA", "")) if record_dict.get("CGPA") else "",
                    "TOTAL_CREDITS_EARNED": str(record_dict.get("TOTAL_CREDITS_EARNED", ""))
                    if record_dict.get("TOTAL_CREDITS_EARNED")
                    else "",
                    "TOTAL_CREDITS_ATTENDED": str(record_dict.get("TOTAL_CREDITS_ATTENDED", ""))
                    if record_dict.get("TOTAL_CREDITS_ATTENDED")
                    else "",
                    "DEGREE_CD": record_dict.get("DEGREE_CD", ""),
                    "DEGREE_RECEIVED_DATE": degree_received_date,
                    "SECOND_DEGREE_CD": record_dict.get("SECOND_DEGREE_CD", ""),
                    "SECOND_DEGREE_RECEIVED_DATE": second_degree_received_date,
                    "EXTERNAL_INSTITUTION_ZIPCODE": record_dict.get(
                        "EXTERNAL_INSTITUTION_ZIPCODE", ""
                    ),
                    "STATUS_SOAHSCH": record_dict.get("STATUS_SOAHSCH", ""),
                    "STATUS_SOAHOLD": record_dict.get("STATUS_SOAHOLD", ""),
                    "STATUS_SOATEST": record_dict.get("STATUS_SOATEST", ""),
                    "TRANSCRIPT_STATUS_FLAG": record_dict.get("TRANSCRIPT_STATUS_FLAG", ""),
                    "STATUS_SHATAEQ": record_dict.get("STATUS_SHATAEQ", ""),
                    "STATUS_SPACMNT": record_dict.get("STATUS_SPACMNT", ""),
                    "PROCESS_STATUS": record_dict.get("PROCESS_STATUS", ""),
                    # Metadata for frontend rendering decisions
                    "_search_field": search_field,
                    "_has_update_permission": has_update_permission,
                }

                data.append(data_row)

            # Return response in modern format (standardized)
            response = {
                "draw": int(draw),
                "recordsTotal": int(total_records),
                "recordsFiltered": int(total_recordswith_filter),
                "data": data,
            }
            
            print(f"[TranscriptReports] ========== RESPONSE ==========")
            print(f"[TranscriptReports] Returning {len(data)} rows, total: {total_records}, filtered: {total_recordswith_filter}")
            print(f"[TranscriptReports] ========== END get_reports_data ==========")
            
            return response

        except Exception as e:
            print(f"[TranscriptReports] ========== ERROR in get_reports_data ==========")
            print(f"[TranscriptReports] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

