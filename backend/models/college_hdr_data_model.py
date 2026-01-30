"""
College HDR Data Model (OCR Verify)
Contains logic for College Transcript HDR Data list, batch view, and update/delete.
CI: Collegehdrdata + Collegeverifier (getcollegehdrdata, getHDRBatchs, UpdateHDRData, UpdateLineHDRData, SaveLineHDRData, DeleteLineData).
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List, Optional
import logging

from config.constants import (
    TBL_TRANSCRIPTHDRDATA,
    TBL_TRANSCRIPTLINEDATA,
    TBL_INSTITUTION_MAPPING,
    TBL_TRANSCRIPTHDROCR,
    COLLEGE_PROJECT_ID,
    SCHOOL_PROJECT_ID,
)
from models.transcript_hdr_data_model import TranscriptHdrDataModel

logger = logging.getLogger(__name__)


def _null_if_empty(val: Any) -> Optional[str]:
    if val is None or val == "" or (isinstance(val, str) and val.upper() == "NULL"):
        return None
    return val


class CollegeHdrDataModel:
    """Model for College HDR Data (Transcript HDR DATA) in OCR verify flow."""

    @staticmethod
    def get_college_hdr_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get College HDR data for DataTables (OCR verify list).
        CI: Collegeverifier::getcollegehdrdata() -> same as gettranscripthdrdata for college.
        """
        return TranscriptHdrDataModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
        )

    @staticmethod
    def get_school_hdr_data(
        db: Session,
        request_data: Dict[str, Any],
        has_update_permission: bool = False,
    ) -> Dict[str, Any]:
        """
        Get School HDR data for DataTables. CI: Collegeverifier::getcollegehdrdata($postData, SCHOOL_PROJECT_ID).
        """
        return TranscriptHdrDataModel.get_reports_data(
            db=db,
            request_data=request_data,
            has_update_permission=has_update_permission,
            project_id=SCHOOL_PROJECT_ID,
        )

    @staticmethod
    def get_hdr_batchs(
        db: Session, batch_id: str, verify_type: str = "no"
    ) -> Dict[str, Any]:
        """
        Get one College HDR batch for edit view. CI: Collegeverifier::getHDRBatchs(batch_id, type).
        """
        return CollegeHdrDataModel._get_hdr_batchs_for_project(
            db, batch_id, COLLEGE_PROJECT_ID, verify_type
        )

    @staticmethod
    def get_hdr_school_batchs(
        db: Session, batch_id: str, verify_type: str = "no"
    ) -> Dict[str, Any]:
        """
        Get one School HDR batch for edit view. CI: Collegeverifier::getHDRSchoolBatchs(batch_id, type).
        Same as get_hdr_batchs but with SCHOOL_PROJECT_ID.
        """
        return CollegeHdrDataModel._get_hdr_batchs_for_project(
            db, batch_id, SCHOOL_PROJECT_ID, verify_type
        )

    @staticmethod
    def _get_hdr_batchs_for_project(
        db: Session, batch_id: str, project_id: int, verify_type: str = "no"
    ) -> Dict[str, Any]:
        """Shared logic for get_hdr_batchs and get_hdr_school_batchs."""
        result = {
            "batch_id": 0,
            "prev_batch_id": None,
            "next_batch_id": None,
            "rec": None,
            "linedata": [],
        }
        if not batch_id:
            return result
        try:
            header_query = text(f"""
                SELECT h.*, m.INSTITUTION_NAME, m.INSTITUTION_ID, o.EXTERNAL_INSTITUTION_NAME, o.FILE_PATH
                FROM {TBL_TRANSCRIPTHDRDATA} AS h
                LEFT JOIN {TBL_INSTITUTION_MAPPING} AS m ON h.INSTITUTION_ID = m.INSTITUTION_ID
                LEFT JOIN {TBL_TRANSCRIPTHDROCR} AS o ON h.BATCH_ID = o.BATCH_ID
                WHERE h.BATCH_ID = :batch_id AND h.PROJECT_ID = :project_id
            """)
            row = db.execute(
                header_query,
                {"batch_id": batch_id, "project_id": project_id},
            ).fetchone()
            if not row:
                return result
            rec = dict(row._mapping)
            result["rec"] = rec
            result["batch_id"] = batch_id

            line_query = text(f"""
                SELECT * FROM {TBL_TRANSCRIPTLINEDATA} WITH(NOLOCK)
                WHERE BATCH_ID = :batch_id
                ORDER BY AUTO_SEQNO
            """)
            lines = db.execute(line_query, {"batch_id": batch_id}).fetchall()
            result["linedata"] = [dict(r._mapping) for r in lines]

            prev_next = db.execute(
                text(f"""
                SELECT BATCH_ID,
                    LAG(BATCH_ID) OVER (ORDER BY BATCH_ID) AS prev_batch_id,
                    LEAD(BATCH_ID) OVER (ORDER BY BATCH_ID) AS next_batch_id
                FROM {TBL_TRANSCRIPTHDRDATA} WITH(NOLOCK)
                WHERE PROJECT_ID = :project_id
                """),
                {"project_id": project_id},
            ).fetchall()
            for r in prev_next:
                if str(r.BATCH_ID) == str(batch_id):
                    result["prev_batch_id"] = r.prev_batch_id
                    result["next_batch_id"] = r.next_batch_id
                    break
            return result
        except Exception as e:
            logger.error(f"_get_hdr_batchs_for_project: {e}")
            raise

    @staticmethod
    def get_distinct_status_flags(db: Session) -> List[Dict[str, Any]]:
        """Get distinct STATUS_FLAG from TBL_TRANSCRIPTHDRDATA. CI: index HDR_STATUS."""
        try:
            q = text(
                f"SELECT DISTINCT STATUS_FLAG FROM {TBL_TRANSCRIPTHDRDATA} WITH(NOLOCK) WHERE STATUS_FLAG IS NOT NULL AND LTRIM(RTRIM(STATUS_FLAG)) <> ''"
            )
            rows = db.execute(q).fetchall()
            return [dict(row._mapping) for row in rows]
        except Exception as e:
            logger.error(f"get_distinct_status_flags: {e}")
            raise

    @staticmethod
    def update_hdr_data(db: Session, batch_id: str, data: Dict[str, Any]) -> bool:
        """Update TBL_TRANSCRIPTHDRDATA by BATCH_ID. CI: UpdateHDRData."""
        try:
            params = dict(data)
            params["batch_id"] = batch_id
            set_parts = ", ".join(f"{k} = :{k}" for k in data.keys())
            q = text(
                f"UPDATE {TBL_TRANSCRIPTHDRDATA} SET {set_parts} WHERE BATCH_ID = :batch_id"
            )
            db.execute(q, params)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"update_hdr_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def update_line_hdr_data(
        db: Session,
        batch_id: str,
        auto_seqno: int,
        data: Dict[str, Any],
    ) -> bool:
        """Update one row in TBL_TRANSCRIPTLINEDATA. CI: UpdateLineHDRData."""
        try:
            params = dict(data)
            params["batch_id"] = batch_id
            params["auto_seqno"] = auto_seqno
            set_parts = ", ".join(f"{k} = :{k}" for k in data.keys())
            q = text(
                f"UPDATE {TBL_TRANSCRIPTLINEDATA} SET {set_parts} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :auto_seqno"
            )
            db.execute(q, params)
            db.commit()
            return True
        except Exception as e:
            logger.error(f"update_line_hdr_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def save_line_hdr_data(db: Session, data: Dict[str, Any]) -> int:
        """Insert one row into TBL_TRANSCRIPTLINEDATA. Returns new AUTO_SEQNO. CI: SaveLineHDRData."""
        try:
            cols = ", ".join(data.keys())
            placeholders = ", ".join(f":{k}" for k in data.keys())
            q = text(
                f"INSERT INTO {TBL_TRANSCRIPTLINEDATA} ({cols}) OUTPUT INSERTED.AUTO_SEQNO VALUES ({placeholders})"
            )
            r = db.execute(q, data)
            row = r.fetchone()
            db.commit()
            return row[0] if row else 0
        except Exception as e:
            logger.error(f"save_line_hdr_data: {e}")
            db.rollback()
            raise

    @staticmethod
    def delete_line_data(
        db: Session, batch_id: str, auto_seqno: int
    ) -> bool:
        """Delete one row from TBL_TRANSCRIPTLINEDATA. CI: DeleteLineData."""
        try:
            q = text(
                f"DELETE FROM {TBL_TRANSCRIPTLINEDATA} WHERE BATCH_ID = :batch_id AND AUTO_SEQNO = :auto_seqno"
            )
            db.execute(q, {"batch_id": batch_id, "auto_seqno": auto_seqno})
            db.commit()
            return True
        except Exception as e:
            logger.error(f"delete_line_data: {e}")
            db.rollback()
            raise
