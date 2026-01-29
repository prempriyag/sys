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
                            f"INSERT INTO {table} (BATCH_ID, SUBJECT, COURSE_ID, COURSE_TITLE, START_TERM, END_TERM, CREDIT_HOURS_EARNED, GRADE, PAGE_NBR) "
                            f"OUTPUT INSERTED.AUTO_SEQNO VALUES (:BATCH_ID, :SUBJECT, :COURSE_ID, :COURSE_TITLE, :START_TERM, :END_TERM, :CREDIT_HOURS_EARNED, :GRADE, :PAGE_NBR)"
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
                            f"START_TERM=:START_TERM, END_TERM=:END_TERM, CREDIT_HOURS_EARNED=:CREDIT_HOURS_EARNED, "
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
            if file_path:
                try:
                    from helpers.encryption_helper import get_encrypt_file_path
                    encrypted_path = get_encrypt_file_path(file_path)
                    hdr_data["TRANSCRIPT_URL"] = f"/api/viewfile/transcript_file?pdf={encrypted_path}"
                except Exception:
                    hdr_data["TRANSCRIPT_URL"] = ""
            else:
                hdr_data["TRANSCRIPT_URL"] = ""

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
