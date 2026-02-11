"""
College Verifier Model
Logic from CI3 Collegeverifier model used by Collegeocrdata controller.
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List, Optional
import logging

from config.constants import (
    TBL_TRANSCRIPTHDROCR,
    TBL_TRANSCRIPT_LINE_OCR_LEFT,
    TBL_TRANSCRIPT_LINE_OCR_RIGHT,
    TBL_TRANSCRIPT_LINE_OCR_MIDDLE,
    TBL_TRANSCRIPT_TEST_SCORE_OCR,
    TBL_BATCH_ASSIGN_STG,
    TBL_ADMIN,
    COLLEGE_PROJECT_ID,
    SCHOOL_PROJECT_ID,
)

logger = logging.getLogger(__name__)

# Map type string to table name
LINE_OCR_TABLES = {
    "left": TBL_TRANSCRIPT_LINE_OCR_LEFT,
    "right": TBL_TRANSCRIPT_LINE_OCR_RIGHT,
    "middle": TBL_TRANSCRIPT_LINE_OCR_MIDDLE,
}


def _null_if_empty(val: Any) -> Optional[str]:
    if val is None or val == "" or (isinstance(val, str) and val.upper() == "NULL"):
        return None
    return val if not isinstance(val, str) else val


class CollegeVerifierModel:
    """Model for College OCR verifier / batch edit operations."""

    @staticmethod
    def get_table_for_type(type_name: str) -> str:
        return LINE_OCR_TABLES.get(type_name.lower(), TBL_TRANSCRIPT_LINE_OCR_LEFT)

    @staticmethod
    def update_line_ocr_data(
        db: Session, table: str, batch_id: str, auto_seqno: int, data: Dict[str, Any]
    ) -> bool:
        """Update one line in LEFT/RIGHT/MIDDLE. CI: UpdateLineOCRData."""
        try:
            params = {"batch_id": batch_id, "auto_seqno": auto_seqno}
            set_parts = []
            for k, v in data.items():
                set_parts.append(f"{k} = :{k}")
                params[k] = v
            if not set_parts:
                return True
            q = text(
                f"UPDATE {table} SET {', '.join(set_parts)} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :auto_seqno"
            )
            db.execute(q, params)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"update_line_ocr_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def save_line_ocr_data(db: Session, table: str, data: Dict[str, Any]) -> int:
        """Insert one line. CI: SaveLineOCRData. Returns new AUTO_SEQNO/Id."""
        try:
            cols = ", ".join(data.keys())
            placeholders = ", ".join(f":{k}" for k in data.keys())
            q = text(f"INSERT INTO {table} ({cols}) OUTPUT INSERTED.AUTO_SEQNO VALUES ({placeholders})")
            r = db.execute(q, data)
            row = r.fetchone()
            db.commit()
            return row[0] if row else 0
        except Exception as e:
            logger.error(f"save_line_ocr_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_hdr_ocr_data(db: Session, batch_id: str, data: Dict[str, Any]) -> bool:
        """Update TRANSCRIPT_HDR_OCR by BATCH_ID. CI: UpdateHDROCRData."""
        try:
            params = dict(data)
            params["batch_id"] = batch_id
            set_parts = ", ".join(f"{k} = :{k}" for k in data.keys())
            q = text(f"UPDATE {TBL_TRANSCRIPTHDROCR} SET {set_parts} WHERE BATCH_ID = :batch_id")
            db.execute(q, params)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"update_hdr_ocr_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_line_data(
        db: Session, table: str, batch_id: str, auto_seqno: int
    ) -> bool:
        """Delete one line. CI: DeleteLineData."""
        try:
            q = text(
                f"DELETE FROM {table} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :auto_seqno"
            )
            db.execute(q, {"batch_id": batch_id, "auto_seqno": auto_seqno})
            db.commit()
            return True
        except Exception as e:
            logger.error(f"delete_line_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_verify_status(
        db: Session,
        batch_id: str,
        data: Dict[str, Any],
        data_line: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Update STATUS_FLAG on header and optionally on line tables. CI: Updateverifystatus."""
        try:
            params = dict(data)
            params["batch_id"] = batch_id
            set_parts = ", ".join(f"{k} = :{k}" for k in data.keys())
            db.execute(
                text(f"UPDATE {TBL_TRANSCRIPTHDROCR} SET {set_parts} WHERE BATCH_ID = :batch_id"),
                params,
            )
            if data_line:
                set_line = ", ".join(f"{k} = :{k}" for k in data_line.keys())
                line_params = dict(data_line)
                line_params["batch_id"] = batch_id
                for tbl in (
                    TBL_TRANSCRIPT_LINE_OCR_LEFT,
                    TBL_TRANSCRIPT_LINE_OCR_RIGHT,
                    TBL_TRANSCRIPT_LINE_OCR_MIDDLE,
                ):
                    db.execute(
                        text(f"UPDATE {tbl} SET {set_line} WHERE BATCH_ID = :batch_id"),
                        line_params,
                    )
            db.commit()
            return True
        except Exception as e:
            logger.error(f"update_verify_status: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_sequence(db: Session, table: str, sequencerow_ids: List[int]) -> bool:
        """Delete multiple rows by AUTO_SEQNO. CI: deletesequence."""
        if not sequencerow_ids:
            return True
        try:
            for sid in sequencerow_ids:
                db.execute(
                    text(f"DELETE FROM {table} WHERE AUTO_SEQNO = :id"),
                    {"id": sid},
                )
            db.commit()
            return True
        except Exception as e:
            logger.error(f"delete_sequence: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_sequence(
        db: Session, table: str, post_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Insert/update multiple rows. CI: updatesequence. Returns {updated, auto_seq: []}."""
        result = {"updated": False, "auto_seq": []}
        auto_seqno_list = post_data.get("AUTO_SEQNO") or []
        if not auto_seqno_list:
            return result
        try:
            for key in range(len(auto_seqno_list)):
                row = {
                    "SUBJECT": _null_if_empty((post_data.get("SUBJECT") or [])[key] if key < len(post_data.get("SUBJECT") or []) else None),
                    "COURSE_ID": _null_if_empty((post_data.get("COURSE_ID") or [])[key] if key < len(post_data.get("COURSE_ID") or []) else None),
                    "COURSE_TITLE": _null_if_empty((post_data.get("COURSE_TITLE") or [])[key] if key < len(post_data.get("COURSE_TITLE") or []) else None),
                    "START_TERM": _null_if_empty((post_data.get("START_TERM") or [])[key] if key < len(post_data.get("START_TERM") or []) else None),
                    "END_TERM": _null_if_empty((post_data.get("END_TERM") or [])[key] if key < len(post_data.get("END_TERM") or []) else None),
                    "EXTERNAL_INSTITUTION_NAME": _null_if_empty((post_data.get("EXTERNAL_INSTITUTION_NAME") or [])[key] if key < len(post_data.get("EXTERNAL_INSTITUTION_NAME") or []) else None),
                    "CREDIT_HOURS_EARNED": _null_if_empty((post_data.get("CREDIT_HOURS_EARNED") or [])[key] if key < len(post_data.get("CREDIT_HOURS_EARNED") or []) else None),
                    "GRADE": _null_if_empty((post_data.get("GRADE") or [])[key] if key < len(post_data.get("GRADE") or []) else None),
                    "PAGE_NBR": _null_if_empty((post_data.get("PAGE_NBR") or [])[key] if key < len(post_data.get("PAGE_NBR") or []) else None),
                }
                auto_seq = (post_data.get("AUTO_SEQNO") or [])[key] if key < len(auto_seqno_list) else None
                batch_id = (post_data.get("BATCH_ID") or "")
                if batch_id and (auto_seq is None or auto_seq == ""):
                    row["BATCH_ID"] = batch_id
                    r = db.execute(
                        text(
                            f"INSERT INTO {table} (BATCH_ID, SUBJECT, COURSE_ID, COURSE_TITLE, START_TERM, END_TERM, EXTERNAL_INSTITUTION_NAME, CREDIT_HOURS_EARNED, GRADE, PAGE_NBR) "
                            f"OUTPUT INSERTED.AUTO_SEQNO VALUES (:BATCH_ID, :SUBJECT, :COURSE_ID, :COURSE_TITLE, :START_TERM, :END_TERM, :EXTERNAL_INSTITUTION_NAME, :CREDIT_HOURS_EARNED, :GRADE, :PAGE_NBR)"
                        ),
                        row,
                    )
                    out = r.fetchone()
                    if out:
                        result["auto_seq"].append(out[0])
                else:
                    db.execute(
                        text(
                            f"UPDATE {table} SET SUBJECT=:SUBJECT, COURSE_ID=:COURSE_ID, COURSE_TITLE=:COURSE_TITLE, "
                            f"START_TERM=:START_TERM, END_TERM=:END_TERM, EXTERNAL_INSTITUTION_NAME=:EXTERNAL_INSTITUTION_NAME, "
                            f"CREDIT_HOURS_EARNED=:CREDIT_HOURS_EARNED, "
                            f"GRADE=:GRADE, PAGE_NBR=:PAGE_NBR WHERE BATCH_ID=:BATCH_ID AND AUTO_SEQNO=:AUTO_SEQNO"
                        ),
                        {
                            **row,
                            "BATCH_ID": batch_id,
                            "AUTO_SEQNO": auto_seq,
                        },
                    )
                    result["updated"] = True
            db.commit()
            result["updated"] = True
            return result
        except Exception as e:
            logger.error(f"update_sequence: {e}")
            db.rollback()
            raise

    @staticmethod
    def get_verifiers_list(db: Session) -> List[Dict[str, Any]]:
        """Users with role verifiers. CI: get_verifiers_list."""
        try:
            q = text(f"""
                SELECT u.* FROM {TBL_ADMIN} AS u
                INNER JOIN PORTAL_ROLES AS r ON u.role_id = r.ID
                WHERE u.status = 1 AND r.ROLE_KEY = 'verifiers'
            """)
            rows = db.execute(q).fetchall()
            return [dict(row._mapping) for row in rows]
        except Exception as e:
            logger.error(f"get_verifiers_list: {e}")
            raise

    @staticmethod
    def get_all_verifier_batch_data(
        db: Session, request_data: Dict[str, Any], project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        College or School OCR assigned batches list for DataTables.
        CI: ajaxverifierbatchelist / getallverifierbatchdata.
        project_id: COLLEGE_PROJECT_ID (default) or SCHOOL_PROJECT_ID for school.
        Returns { draw, recordsTotal, recordsFiltered, data }.
        """
        pid = project_id if project_id is not None else COLLEGE_PROJECT_ID
        draw = int(request_data.get("draw", 1))
        start = int(request_data.get("start", 0))
        length = int(request_data.get("length", 10))
        if length <= 0:
            length = 10
        order_list = request_data.get("order") or []
        columns_list = request_data.get("columns") or []
        field_type = (request_data.get("fieldType") or "").strip()
        username_filter = (request_data.get("username") or "").strip()
        institution_name = (request_data.get("institution_name") or "").strip()
        fromdate = (request_data.get("fromdate") or "").strip()
        todate = (request_data.get("todate") or "").strip()
        search_val = (request_data.get("search") or {}).get("value") or ""
        if isinstance(search_val, str):
            search_val = search_val.strip()

        # Order by: map column index to SQL column (frontend: BATCH_ID, VERIFIER_NAME, USERNAME, STATUS_FLAG, INSTITUTION_TYPE, OCR_EXTRACTED_DATE)
        order_col_map = {
            "BATCH_ID": "t.BATCH_ID",
            "VERIFIER_NAME": "t.PORTAL_VERIFIER_NAME",
            "USERNAME": "t.PORTAL_VERIFIER_NAME",
            "STATUS_FLAG": "t.STATUS_FLAG",
            "INSTITUTION_TYPE": "t.EXTERNAL_INSTITUTION_NAME",
            "OCR_EXTRACTED_DATE": "COALESCE(t.OCR_EXTRACTED_DATE, t.OCR_UPLOADED_DATE)",
        }
        order_col = "t.BATCH_ID"
        order_dir = "DESC"
        if order_list and columns_list:
            col_idx = int(order_list[0].get("column", 0))
            order_dir = (order_list[0].get("dir") or "desc").upper()
            if order_dir not in ("ASC", "DESC"):
                order_dir = "DESC"
            if 0 <= col_idx < len(columns_list):
                data_key = columns_list[col_idx].get("data")
                if data_key and data_key in order_col_map:
                    order_col = order_col_map[data_key]

        # Build WHERE: PROJECT_ID + filters
        where_parts = [f"t.PROJECT_ID = :pid"]
        params: Dict[str, Any] = {"pid": pid}

        if field_type:
            where_parts.append("t.STATUS_FLAG = :field_type")
            params["field_type"] = field_type
        if username_filter:
            where_parts.append("t.PORTAL_VERIFIER_NAME LIKE :username_filter")
            params["username_filter"] = f"%{username_filter}%"
        if institution_name:
            where_parts.append("t.EXTERNAL_INSTITUTION_NAME LIKE :institution_name")
            params["institution_name"] = f"%{institution_name}%"
        if fromdate:
            where_parts.append("CAST(COALESCE(t.OCR_EXTRACTED_DATE, t.OCR_UPLOADED_DATE) AS DATE) >= CAST(:fromdate AS DATE)")
            params["fromdate"] = fromdate
        if todate:
            where_parts.append("CAST(COALESCE(t.OCR_EXTRACTED_DATE, t.OCR_UPLOADED_DATE) AS DATE) <= CAST(:todate AS DATE)")
            params["todate"] = todate
        if search_val:
            where_parts.append(
                "(t.BATCH_ID LIKE :search_val OR t.PORTAL_VERIFIER_NAME LIKE :search_val2 "
                "OR t.EXTERNAL_INSTITUTION_NAME LIKE :search_val2 OR t.STATUS_FLAG LIKE :search_val2)"
            )
            params["search_val"] = f"%{search_val}%"
            params["search_val2"] = f"%{search_val}%"

        where_sql = " AND ".join(where_parts)

        # Count total (no filters except PROJECT_ID)
        count_total_sql = f"""
            SELECT COUNT(*) AS c FROM {TBL_TRANSCRIPTHDROCR} AS t WITH(NOLOCK)
            WHERE t.PROJECT_ID = :pid
        """
        total_result = db.execute(text(count_total_sql), {"pid": pid}).fetchone()
        records_total = total_result[0] if total_result else 0

        # Count filtered
        count_filtered_sql = f"""
            SELECT COUNT(*) AS c FROM {TBL_TRANSCRIPTHDROCR} AS t WITH(NOLOCK)
            WHERE {where_sql}
        """
        filtered_result = db.execute(text(count_filtered_sql), params).fetchone()
        records_filtered = filtered_result[0] if filtered_result else 0

        # Data query: select columns needed for table (COALESCE supports either date column)
        data_sql = f"""
            SELECT t.BATCH_ID, t.PORTAL_VERIFIER_NAME, t.STATUS_FLAG, t.EXTERNAL_INSTITUTION_NAME,
                   COALESCE(t.OCR_EXTRACTED_DATE, t.OCR_UPLOADED_DATE) AS OCR_EXTRACTED_DATE
            FROM {TBL_TRANSCRIPTHDROCR} AS t WITH(NOLOCK)
            WHERE {where_sql}
            ORDER BY {order_col} {order_dir}
            OFFSET :start ROWS FETCH NEXT :length ROWS ONLY
        """
        params["start"] = start
        params["length"] = length
        rows = db.execute(text(data_sql), params).fetchall()

        data = []
        for r in rows:
            row = r._mapping
            verifier = row.get("PORTAL_VERIFIER_NAME") or ""
            data.append({
                "BATCH_ID": row.get("BATCH_ID") or "",
                "VERIFIER_NAME": verifier,
                "USERNAME": verifier,
                "STATUS_FLAG": row.get("STATUS_FLAG") or "",
                "INSTITUTION_TYPE": row.get("EXTERNAL_INSTITUTION_NAME") or "",
                "OCR_EXTRACTED_DATE": str(row.get("OCR_EXTRACTED_DATE") or ""),
            })

        return {
            "draw": draw,
            "recordsTotal": records_total,
            "recordsFiltered": records_filtered,
            "data": data,
        }

    # ---------- School OCR (TBL_TRANSCRIPT_TEST_SCORE_OCR) ----------

    @staticmethod
    def get_edit_school_batchs(db: Session, batch_id: str) -> Dict[str, Any]:
        """
        Get School OCR batch: hdr from TBL_TRANSCRIPTHDROCR (SCHOOL_PROJECT_ID),
        line_data from TBL_TRANSCRIPT_TEST_SCORE_OCR. CI: Schoolverifier::getEditSchoolBatchs.
        """
        result = {"batch_id": batch_id, "hdr_data": None, "line_data": [], "error_msg": True}
        if not batch_id:
            return result
        try:
            hdr = db.execute(
                text(f"SELECT * FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE BATCH_ID = :bid AND PROJECT_ID = :pid"),
                {"bid": batch_id, "pid": SCHOOL_PROJECT_ID},
            ).fetchone()
            if not hdr:
                return result
            hdr_data = dict(hdr._mapping)
            file_path = hdr_data.get("FILE_PATH") or ""

            # Build TRANSCRIPT_URL (handles FTP→share-path conversion)
            from helpers.common_helper import build_transcript_url
            hdr_data["TRANSCRIPT_URL"] = build_transcript_url(
                db, file_path, batch_id, SCHOOL_PROJECT_ID
            )

            line_rows = db.execute(
                text(f"SELECT * FROM {TBL_TRANSCRIPT_TEST_SCORE_OCR} WITH(NOLOCK) WHERE BATCH_ID = :bid ORDER BY AUTO_SEQNO"),
                {"bid": batch_id},
            ).fetchall()
            line_data = [dict(r._mapping) for r in line_rows]
            result["hdr_data"] = hdr_data
            result["line_data"] = line_data
            result["error_msg"] = False
            return result
        except Exception as e:
            logger.error(f"get_edit_school_batchs: {e}")
            raise

    @staticmethod
    def update_line_test_score_ocr(
        db: Session, batch_id: str, auto_seqno: int, data: Dict[str, Any]
    ) -> bool:
        """Update one row in TBL_TRANSCRIPT_TEST_SCORE_OCR. CI: UpdateLineTestScoreOCR."""
        try:
            params = dict(data)
            params["batch_id"] = batch_id
            params["auto_seqno"] = auto_seqno
            set_parts = ", ".join(f"{k} = :{k}" for k in data.keys())
            q = text(
                f"UPDATE {TBL_TRANSCRIPT_TEST_SCORE_OCR} SET {set_parts} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :auto_seqno"
            )
            db.execute(q, params)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"update_line_test_score_ocr: {e}")
            db.rollback()
            raise

    @staticmethod
    def save_line_test_score_ocr(db: Session, data: Dict[str, Any]) -> int:
        """Insert one row into TBL_TRANSCRIPT_TEST_SCORE_OCR. Returns new AUTO_SEQNO. CI: SaveLineTestScoreOCR."""
        try:
            cols = ", ".join(data.keys())
            placeholders = ", ".join(f":{k}" for k in data.keys())
            q = text(
                f"INSERT INTO {TBL_TRANSCRIPT_TEST_SCORE_OCR} ({cols}) OUTPUT INSERTED.AUTO_SEQNO VALUES ({placeholders})"
            )
            r = db.execute(q, data)
            row = r.fetchone()
            db.commit()
            return row[0] if row else 0
        except Exception as e:
            logger.error(f"save_line_test_score_ocr: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_line_test_score_ocr(db: Session, batch_id: str, auto_seqno: int) -> bool:
        """Delete one row from TBL_TRANSCRIPT_TEST_SCORE_OCR. CI: DeleteLineTestScoreOCR."""
        try:
            q = text(
                f"DELETE FROM {TBL_TRANSCRIPT_TEST_SCORE_OCR} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :auto_seqno"
            )
            db.execute(q, {"batch_id": batch_id, "auto_seqno": auto_seqno})
            db.commit()
            return True
        except Exception as e:
            logger.error(f"delete_line_test_score_ocr: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_sequence_test_score_ocr(db: Session, batch_id: str, sequencerow_ids: List[int]) -> bool:
        """Delete multiple rows from TBL_TRANSCRIPT_TEST_SCORE_OCR. CI: schooldeletesequence."""
        if not sequencerow_ids:
            return True
        try:
            for sid in sequencerow_ids:
                db.execute(
                    text(
                        f"DELETE FROM {TBL_TRANSCRIPT_TEST_SCORE_OCR} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :id"
                    ),
                    {"batch_id": batch_id, "id": sid},
                )
            db.commit()
            return True
        except Exception as e:
            logger.error(f"delete_sequence_test_score_ocr: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_sequence_test_score_ocr(
        db: Session, batch_id: str, post_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Bulk update/insert rows in TBL_TRANSCRIPT_TEST_SCORE_OCR. CI: school_multiple_update. Returns {auto_seq: []}."""
        result = {"updated": False, "auto_seq": []}
        auto_seqno_list = post_data.get("AUTO_SEQNO") or []
        if not auto_seqno_list:
            return result
        try:
            for key in range(len(auto_seqno_list)):
                row = {
                    "TEST_TYPE": _null_if_empty((post_data.get("TEST_TYPE") or [])[key] if key < len(post_data.get("TEST_TYPE") or []) else None),
                    "TEST_DATE": _null_if_empty((post_data.get("TEST_DATE") or [])[key] if key < len(post_data.get("TEST_DATE") or []) else None),
                    "SUBJECT": _null_if_empty((post_data.get("SUBJECT") or [])[key] if key < len(post_data.get("SUBJECT") or []) else None),
                    "SCORE": _null_if_empty((post_data.get("SCORE") or [])[key] if key < len(post_data.get("SCORE") or []) else None),
                    "PAGE_NBR": _null_if_empty((post_data.get("PAGE_NBR") or [])[key] if key < len(post_data.get("PAGE_NBR") or []) else None),
                }
                auto_seq = (post_data.get("AUTO_SEQNO") or [])[key] if key < len(auto_seqno_list) else None
                if batch_id and (auto_seq is None or auto_seq == ""):
                    row["BATCH_ID"] = batch_id
                    r = db.execute(
                        text(
                            f"INSERT INTO {TBL_TRANSCRIPT_TEST_SCORE_OCR} (BATCH_ID, TEST_TYPE, TEST_DATE, SUBJECT, SCORE, PAGE_NBR) "
                            f"OUTPUT INSERTED.AUTO_SEQNO VALUES (:BATCH_ID, :TEST_TYPE, :TEST_DATE, :SUBJECT, :SCORE, :PAGE_NBR)"
                        ),
                        row,
                    )
                    out = r.fetchone()
                    if out:
                        result["auto_seq"].append(out[0])
                else:
                    db.execute(
                        text(
                            f"UPDATE {TBL_TRANSCRIPT_TEST_SCORE_OCR} SET TEST_TYPE=:TEST_TYPE, TEST_DATE=:TEST_DATE, "
                            f"SUBJECT=:SUBJECT, SCORE=:SCORE, PAGE_NBR=:PAGE_NBR WHERE BATCH_ID=:BATCH_ID AND AUTO_SEQNO=:AUTO_SEQNO"
                        ),
                        {**row, "BATCH_ID": batch_id, "AUTO_SEQNO": auto_seq},
                    )
                    result["updated"] = True
            db.commit()
            result["updated"] = True
            return result
        except Exception as e:
            logger.error(f"update_sequence_test_score_ocr: {e}")
            db.rollback()
            raise
