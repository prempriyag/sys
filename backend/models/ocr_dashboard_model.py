"""
OCR Dashboard Model
Contains dashboard count logic from CI3 Collegeverifier::dashboardcounts()
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
import logging

from config.constants import (
    TBL_TRANSCRIPTHDROCR,
    TBL_TRANSCRIPTHDRDATA,
    TBL_BATCH_ASSIGN_STG,
    TBL_INSTITUTION_MAPPING,
    COLLEGE_PROJECT_ID,
    SCHOOL_PROJECT_ID,
)

logger = logging.getLogger(__name__)


class OCRDashboardModel:
    """Model for OCR dashboard counts"""

    @staticmethod
    def dashboard_counts(db: Session) -> Dict[str, int]:
        """
        Get dashboard counts for OCR module.
        Matches CI3 Collegeverifier::dashboardcounts()
        """
        try:
            result = {}

            # Total transcripts (all from TRANSCRIPT_HDR_OCR)
            r = db.execute(text(f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK)")).fetchone()
            result["total_tr"] = r[0] if r else 0

            # College transcripts
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE PROJECT_ID = :pid"
            ), {"pid": COLLEGE_PROJECT_ID}).fetchone()
            result["college_tr"] = r[0] if r else 0

            # School transcripts
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE PROJECT_ID = :pid"
            ), {"pid": SCHOOL_PROJECT_ID}).fetchone()
            result["school_tr"] = r[0] if r else 0

            # Assigned (HOS.BATCH_ID between BAS.FROM_BATCH_ID and BAS.TO_BATCH_ID)
            r = db.execute(text(f"""
                SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} AS HOS WITH(NOLOCK)
                INNER JOIN {TBL_BATCH_ASSIGN_STG} AS BAS WITH(NOLOCK)
                ON HOS.BATCH_ID BETWEEN BAS.FROM_BATCH_ID AND BAS.TO_BATCH_ID
            """)).fetchone()
            result["assigned_tr"] = r[0] if r else 0

            # Unassigned (VERIFICATION_SOURCE is null and STATUS_FLAG is null)
            r = db.execute(text(f"""
                SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} AS HOS WITH(NOLOCK)
                WHERE HOS.VERIFICATION_SOURCE IS NULL AND (HOS.STATUS_FLAG IS NULL OR LTRIM(RTRIM(ISNULL(HOS.STATUS_FLAG,''))) = '')
            """)).fetchone()
            result["unassigned_tr"] = r[0] if r else 0

            # ABBYY (VERIFICATION_SOURCE = 'ABBYY')
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE VERIFICATION_SOURCE = 'ABBYY'"
            )).fetchone()
            result["abbyy_tr"] = r[0] if r else 0

            # Portal (VERIFICATION_SOURCE = 'PORTAL')
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE VERIFICATION_SOURCE = 'PORTAL'"
            )).fetchone()
            result["portal_tr"] = r[0] if r else 0

            # School verified
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE STATUS_FLAG = 'VERIFIED' AND PROJECT_ID = :pid"
            ), {"pid": SCHOOL_PROJECT_ID}).fetchone()
            result["schoolverified_tr"] = r[0] if r else 0

            # School to be verified (TOBEVERIFIED, RECONFIRM)
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE STATUS_FLAG IN ('TOBEVERIFIED','RECONFIRM') AND PROJECT_ID = :pid"
            ), {"pid": SCHOOL_PROJECT_ID}).fetchone()
            result["schooltobeverified_tr"] = r[0] if r else 0

            # School processed (from TRANSCRIPT_HDR_DATA)
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDRDATA} WITH(NOLOCK) WHERE STATUS_FLAG = 'PROCESSED' AND PROJECT_ID = :pid"
            ), {"pid": SCHOOL_PROJECT_ID}).fetchone()
            result["schoolprocessed_tr"] = r[0] if r else 0

            # College verified
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE STATUS_FLAG = 'VERIFIED' AND PROJECT_ID = :pid"
            ), {"pid": COLLEGE_PROJECT_ID}).fetchone()
            result["collegeverified_tr"] = r[0] if r else 0

            # College to be verified
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDROCR} WITH(NOLOCK) WHERE STATUS_FLAG IN ('TOBEVERIFIED','RECONFIRM') AND PROJECT_ID = :pid"
            ), {"pid": COLLEGE_PROJECT_ID}).fetchone()
            result["collegetobeverified_tr"] = r[0] if r else 0

            # College processed (from TRANSCRIPT_HDR_DATA)
            r = db.execute(text(
                f"SELECT count(*) as c FROM {TBL_TRANSCRIPTHDRDATA} WITH(NOLOCK) WHERE STATUS_FLAG = 'PROCESSED' AND PROJECT_ID = :pid"
            ), {"pid": COLLEGE_PROJECT_ID}).fetchone()
            result["collegeprocessed_tr"] = r[0] if r else 0

            return result
        except Exception as e:
            logger.error(f"Error in dashboard_counts: {e}")
            raise

    @staticmethod
    def get_college_list(db: Session, search_term: str = "", limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get distinct institution list for autocomplete.
        Matches CI3 Dashboard::getcollegelist() using INSTITUTION_MAPPING.
        """
        try:
            if not search_term or not search_term.strip():
                return []
            safe = search_term.strip().replace("'", "''")
            q = text(f"""
                SELECT DISTINCT INSTITUTION_NAME, INSTITUTION_ID
                FROM {TBL_INSTITUTION_MAPPING} WITH(NOLOCK)
                WHERE INSTITUTION_NAME LIKE :pat OR CAST(INSTITUTION_ID AS VARCHAR) LIKE :pat
                ORDER BY INSTITUTION_NAME ASC
                OFFSET 0 ROWS FETCH NEXT :lim ROWS ONLY
            """)
            rows = db.execute(q, {"pat": f"%{safe}%", "lim": limit}).fetchall()
            return [
                {"INSTITUTION_NAME": r[0], "INSTITUTION_ID": r[1]}
                for r in rows
            ]
        except Exception as e:
            logger.error(f"Error in get_college_list: {e}")
            raise
