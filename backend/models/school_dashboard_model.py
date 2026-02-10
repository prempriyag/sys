"""
Dashboard Model
Handles database queries for dashboard analytics
Based on CI3 Dashboard controller methods
"""

from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Dict, Any, List
from datetime import datetime, timedelta
from calendar import monthrange
import logging

from config.constants import (
    TBL_KICKOUT, TBL_DOWNLOAD, TBL_ARTICULATION,
    SCHOOL_PROJECT_ID, TBL_INSTITUTION_MAPPING,
    TBL_DIGISCRIPTBOTLOG
)

logger = logging.getLogger(__name__)


class SchoolDashboardModel:
    @staticmethod
    def get_months_slab(fromdate: str, todate: str) -> List[Dict[str, str]]:
        """Get list of months between fromdate and todate"""
        start = datetime.strptime(fromdate.split()[0], '%Y-%m-%d')
        end = datetime.strptime(todate.split()[0], '%Y-%m-%d')
        
        months = []
        current = start.replace(day=1)
        
        while current <= end:
            if current == start.replace(day=1):
                month_start = start
            else:
                month_start = current
                
            if current.year == end.year and current.month == end.month:
                month_end = end
            else:
                month_end = current.replace(day=monthrange(current.year, current.month)[1])
            
            months.append({
                'StartDate': month_start.strftime('%Y-%m-%d'),
                'EndDate': month_end.strftime('%Y-%m-%d')
            })
            
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        return months

    @staticmethod
    def get_days_list(fromdate: str, todate: str) -> List[str]:
        """Get list of days between fromdate and todate"""
        start = datetime.strptime(fromdate.split()[0], '%Y-%m-%d')
        end = datetime.strptime(todate.split()[0], '%Y-%m-%d')
        
        days = []
        current = start
        while current <= end:
            days.append(current.strftime('%Y-%m-%d'))
            current += timedelta(days=1)
        
        return days

    @staticmethod
    def get_dashboard_data(
        db: Session,
        college_name: str,
        fromdate: str,
        todate: str,
        use_daily: bool = False
    ) -> Dict[str, Any]:
        """Get all dashboard data"""
        try:
            # Get date ranges
            if use_daily:
                date_ranges = SchoolDashboardModel.get_days_list(fromdate, todate)
                labels = [datetime.strptime(d, '%Y-%m-%d').strftime('%d %b') for d in date_ranges]
            else:
                date_ranges = SchoolDashboardModel.get_months_slab(fromdate, todate)
                labels = [datetime.strptime(r['StartDate'], '%Y-%m-%d').strftime('%b %Y') for r in date_ranges]

            # Build filter condition
            college_filter = ""
            if college_name:
                college_filter = f" AND INSTITUTION_ID = '{college_name}'"

            # Get transcript sources data
            transcript_sources = SchoolDashboardModel.get_transcript_sources_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get transcript status data
            transcript_status = SchoolDashboardModel.get_transcript_status_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get transcript processed data
            transcript_processed = SchoolDashboardModel.get_transcript_processed_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get initial kickouts data
            initial_kickouts = SchoolDashboardModel.get_initial_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get transcript kickouts data
            transcript_kickouts = SchoolDashboardModel.get_transcript_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get articulation kickouts data
            articulation_kickouts = SchoolDashboardModel.get_articulation_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get articulation courses kickouts data
            articulation_courses_kickouts = SchoolDashboardModel.get_articulation_courses_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get donut chart data
            transcript_status_donut = SchoolDashboardModel.get_transcript_status_donut(db, college_name, fromdate, todate)
            articulation_status_donut = SchoolDashboardModel.get_articulation_status_donut(db, college_name, fromdate, todate)
            articulation_courses_status_donut = SchoolDashboardModel.get_articulation_courses_status_donut(db, college_name, fromdate, todate)

            return {
                "transcriptSources": {
                    "labels": labels,
                    "datasets": transcript_sources
                },
                "transcriptStatus": {
                    "labels": labels,
                    "datasets": transcript_status
                },
                "transcriptProcessed": {
                    "labels": labels,
                    "datasets": transcript_processed
                },
                "initialKickouts": {
                    "labels": labels,
                    "datasets": initial_kickouts
                },
                "transcriptKickouts": {
                    "labels": labels,
                    "datasets": transcript_kickouts
                },
                "articulationKickouts": {
                    "labels": labels,
                    "datasets": articulation_kickouts
                },
                "articulationCoursesKickouts": {
                    "labels": labels,
                    "datasets": articulation_courses_kickouts
                },
                "transcriptStatusDonut": transcript_status_donut,
                "articulationStatusDonut": articulation_status_donut,
                "articulationCoursesStatusDonut": articulation_courses_status_donut,
            }

        except Exception as e:
            logger.exception("Error in get_dashboard_data")
            raise

    @staticmethod
    def get_transcript_sources_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get transcripts downloaded from sources (Parchment, NSC, Scanned, ScannedUnofficial)"""
        try:
            source_types = ['Parchment', 'NSC', 'Scanned', 'ScannedUnofficial']
            college_filter = f" AND d.INSTITUTION_ID = '{college_name}'" if college_name else ""

            datasets = []
            for source_type in source_types:
                if use_daily:
                    query = text(f"""
                        SELECT CAST(UPLOADED_DATETIME AS DATE) as date, COUNT(*) as count
                        FROM {TBL_DOWNLOAD} t
                        LEFT JOIN {TBL_KICKOUT} d ON d.BATCH_ID = t.BATCH_ID
                        WHERE (t.PROJECT_ID = {SCHOOL_PROJECT_ID})
                        AND CAST(UPLOADED_DATETIME AS DATE) >= :fromdate
                        AND CAST(UPLOADED_DATETIME AS DATE) <= :todate
                        AND SOURCE_TYPE = :source_type
                        {college_filter}
                        GROUP BY CAST(UPLOADED_DATETIME AS DATE)
                        ORDER BY CAST(UPLOADED_DATETIME AS DATE)
                    """)
                else:
                    query = text(f"""
                        SELECT YEAR(UPLOADED_DATETIME) as year, MONTH(UPLOADED_DATETIME) as month, COUNT(*) as count
                        FROM {TBL_DOWNLOAD} t
                        LEFT JOIN {TBL_KICKOUT} d ON d.BATCH_ID = t.BATCH_ID
                        WHERE (t.PROJECT_ID = {SCHOOL_PROJECT_ID})
                        AND CAST(UPLOADED_DATETIME AS DATE) >= :fromdate
                        AND CAST(UPLOADED_DATETIME AS DATE) <= :todate
                        AND SOURCE_TYPE = :source_type
                        {college_filter}
                        GROUP BY YEAR(UPLOADED_DATETIME), MONTH(UPLOADED_DATETIME)
                        ORDER BY YEAR(UPLOADED_DATETIME), MONTH(UPLOADED_DATETIME)
                    """)

                result = db.execute(query, {
                    "fromdate": fromdate.split()[0],
                    "todate": todate.split()[0],
                    "source_type": source_type
                }).fetchall()

                # Map results to date ranges
                data_map = {}
                for row in result:
                    if use_daily:
                        key = row.date.strftime('%Y-%m-%d')
                    else:
                        key = f"{row.year}-{row.month:02d}"
                    data_map[key] = row.count

                # Build data array matching date ranges
                data = []
                for dr in date_ranges:
                    if use_daily:
                        key = dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        key = f"{dt.year}-{dt.month:02d}"
                    data.append(data_map.get(key, 0))

                datasets.append({
                    "name": source_type,
                    "data": data
                })

            return datasets
        except Exception as e:
            logger.exception("Error in get_transcript_sources_data")
            return []

    @staticmethod
    def get_transcript_status_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get transcript status data (NEW, RERUN, PROCESSED, DUPLICATE, FAILED)"""
        try:
            status_types = ['NEW', 'RERUN', 'PROCESSED', 'DUPLICATE', 'FAILED']
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""

            datasets = []
            for status in status_types:
                if use_daily:
                    query = text(f"""
                        SELECT CAST(LAST_UPDATED_DATETIME AS DATE) as date, COUNT(*) as count
                        FROM {TBL_KICKOUT}
                        WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID} )
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                        AND UPPER(TRANSCRIPT_STATUS_FLAG) = :status
                        {college_filter}
                        GROUP BY CAST(LAST_UPDATED_DATETIME AS DATE)
                        ORDER BY CAST(LAST_UPDATED_DATETIME AS DATE)
                    """)
                else:
                    query = text(f"""
                        SELECT YEAR(LAST_UPDATED_DATETIME) as year, MONTH(LAST_UPDATED_DATETIME) as month, COUNT(*) as count
                        FROM {TBL_KICKOUT}
                        WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID})
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                        AND UPPER(TRANSCRIPT_STATUS_FLAG) = :status
                        {college_filter}
                        GROUP BY YEAR(LAST_UPDATED_DATETIME), MONTH(LAST_UPDATED_DATETIME)
                        ORDER BY YEAR(LAST_UPDATED_DATETIME), MONTH(LAST_UPDATED_DATETIME)
                    """)

                result = db.execute(query, {
                    "fromdate": fromdate.split()[0],
                    "todate": todate.split()[0],
                    "status": status
                }).fetchall()

                data_map = {}
                for row in result:
                    if use_daily:
                        key = row.date.strftime('%Y-%m-%d')
                    else:
                        key = f"{row.year}-{row.month:02d}"
                    data_map[key] = row.count

                data = []
                for dr in date_ranges:
                    if use_daily:
                        key = dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        key = f"{dt.year}-{dt.month:02d}"
                    data.append(data_map.get(key, 0))

                datasets.append({
                    "name": status,
                    "data": data
                })

            return datasets
        except Exception as e:
            logger.exception("Error in get_transcript_status_data")
            return []

    @staticmethod
    def get_transcript_processed_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get transcripts processed in Banner for school
        Matches CI3 school dashboard:
          - Downloaded   (transcript_download_dashboard)
          - SOAHSCH      (transcript_SAAADMS_dashboard)
          - SOATEST      (transcript_SAAADMS_dashboard)
          - SOAHOLD      (transcript_SAAADMS_dashboard)
          - BDMS         (transcript_SAAADMS_dashboard)
        """
        try:
            status_flags = ['SOAHSCH', 'SOATEST', 'SOAHOLD', 'BDMS']
            all_names = ['Downloaded'] + status_flags
            if not date_ranges:
                return [{"name": n, "data": []} for n in all_names]

            college_filter_t = f" AND (t.INSTITUTION_ID = '{college_name}')" if college_name else ""
            college_filter_d = f" AND d.INSTITUTION_ID = '{college_name}'" if college_name else ""

            first_start_date = fromdate.split()[0]
            last_end_date = todate.split()[0]

            if use_daily:
                date_values = ", ".join([f"('{dr}')" for dr in date_ranges])
            else:
                date_values = ", ".join([f"('{dr['StartDate']}')" for dr in date_ranges])
                first_start_date = date_ranges[0]['StartDate']
                last_end_date = date_ranges[-1]['EndDate']

            # helper to map rows to date_ranges
            def _map_rows(rows, col_name, daily=use_daily):
                data_map = {}
                for row in rows:
                    rd = dict(row._mapping) if hasattr(row, '_mapping') else {}
                    if daily:
                        dv = rd.get('date', rd.get('DAY', None))
                        if dv is None:
                            dv = row[0]
                        key = dv.strftime('%Y-%m-%d') if hasattr(dv, 'strftime') else str(dv)[:10]
                    else:
                        y = rd.get('year', row[1] if len(row) > 1 else 0)
                        m = rd.get('mth', row[2] if len(row) > 2 else 0)
                        key = f"{y}-{int(m):02d}"
                    data_map[key] = rd.get(col_name, 0)
                out = []
                for dr in date_ranges:
                    if daily:
                        k = dr[:10] if len(dr) > 10 else dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        k = f"{dt.year}-{dt.month:02d}"
                    out.append(data_map.get(k, 0) or 0)
                return out

            # ─── 1. Downloaded ───
            if use_daily:
                dl_query = text(f"""
                    SELECT
                        month_data.date AS date,
                        COUNT(t.BATCH_ID) AS resultdata
                    FROM
                        (VALUES {date_values}) AS month_data(date)
                    LEFT JOIN
                        {TBL_DOWNLOAD} AS t
                        ON CAST(t.UPLOADED_DATETIME AS DATE) = month_data.date
                        AND t.PROJECT_ID = {SCHOOL_PROJECT_ID}
                    LEFT JOIN
                        {TBL_KICKOUT} AS d
                        ON COALESCE(d.BATCH_ID, '') = COALESCE(t.BATCH_ID, '')
                    WHERE CAST(t.UPLOADED_DATETIME AS DATE) BETWEEN '{first_start_date}' AND '{last_end_date}'
                        {college_filter_d}
                    GROUP BY month_data.date
                    ORDER BY month_data.date
                """)
            else:
                dl_query = text(f"""
                    SELECT
                        LEFT(DATENAME(month, month_data.date), 3) AS month,
                        YEAR(month_data.date) AS year,
                        DATEPART(MM, month_data.date) AS mth,
                        COUNT(t.BATCH_ID) AS resultdata
                    FROM
                        (VALUES {date_values}) AS month_data(date)
                    LEFT JOIN
                        {TBL_DOWNLOAD} AS t
                        ON MONTH(t.UPLOADED_DATETIME) = MONTH(month_data.date)
                        AND YEAR(t.UPLOADED_DATETIME) = YEAR(month_data.date)
                        AND t.PROJECT_ID = {SCHOOL_PROJECT_ID}
                        AND CAST(t.UPLOADED_DATETIME AS DATE) BETWEEN '{first_start_date}' AND '{last_end_date}'
                    LEFT JOIN
                        {TBL_KICKOUT} AS d
                        ON COALESCE(d.BATCH_ID, '') = COALESCE(t.BATCH_ID, '')
                    WHERE 1=1 {college_filter_d}
                    GROUP BY
                        DATENAME(month, month_data.date),
                        YEAR(month_data.date),
                        DATEPART(MM, month_data.date)
                    ORDER BY
                        YEAR(month_data.date),
                        DATEPART(MM, month_data.date)
                """)
            dl_rows = db.execute(dl_query).fetchall()
            downloaded_data = _map_rows(dl_rows, 'resultdata')

            # ─── 2. SOAHSCH / SOATEST / SOAHOLD / BDMS ───
            sql_cols = ", ".join([
                f"ISNULL(SUM(CASE WHEN UPPER(t.STATUS_{sf}) = 'PROCESSED' THEN 1 ELSE 0 END), 0) AS {sf}Count"
                for sf in status_flags
            ])

            if use_daily:
                saaadms_query = text(f"""
                    SELECT
                        month_data.date AS date,
                        {sql_cols}
                    FROM
                        (VALUES {date_values}) AS month_data(date)
                    LEFT JOIN
                        {TBL_KICKOUT} AS t
                        ON CAST(t.LAST_UPDATED_DATETIME AS DATE) = month_data.date
                        AND (t.PROJECT_ID = {SCHOOL_PROJECT_ID})
                        {college_filter_t}
                    GROUP BY month_data.date
                    ORDER BY month_data.date
                """)
            else:
                saaadms_query = text(f"""
                    SELECT
                        LEFT(DATENAME(month, month_data.date), 3) AS month,
                        YEAR(month_data.date) AS year,
                        DATEPART(MM, month_data.date) AS mth,
                        {sql_cols}
                    FROM
                        (VALUES {date_values}) AS month_data(date)
                    LEFT JOIN
                        {TBL_KICKOUT} AS t
                        ON MONTH(t.LAST_UPDATED_DATETIME) = MONTH(month_data.date)
                        AND YEAR(t.LAST_UPDATED_DATETIME) = YEAR(month_data.date)
                        AND (t.PROJECT_ID = {SCHOOL_PROJECT_ID})
                        AND CAST(t.LAST_UPDATED_DATETIME AS DATE) BETWEEN '{first_start_date}' AND '{last_end_date}'
                        {college_filter_t}
                    GROUP BY
                        DATENAME(month, month_data.date),
                        YEAR(month_data.date),
                        DATEPART(MM, month_data.date)
                    ORDER BY
                        YEAR(month_data.date),
                        DATEPART(MM, month_data.date)
                """)

            saaadms_rows = db.execute(saaadms_query).fetchall()

            saaadms_map = {}
            for row in saaadms_rows:
                rd = dict(row._mapping) if hasattr(row, '_mapping') else {}
                if use_daily:
                    dv = rd.get('date', row[0])
                    key = dv.strftime('%Y-%m-%d') if hasattr(dv, 'strftime') else str(dv)[:10]
                else:
                    y = rd.get('year', row[1])
                    m = rd.get('mth', row[2])
                    key = f"{y}-{int(m):02d}"
                saaadms_map[key] = rd

            flag_datasets = {}
            for sf in status_flags:
                data = []
                for dr in date_ranges:
                    if use_daily:
                        k = dr[:10] if len(dr) > 10 else dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        k = f"{dt.year}-{dt.month:02d}"
                    cnt = saaadms_map.get(k, {}).get(f"{sf}Count", 0)
                    data.append(cnt if cnt else 0)
                flag_datasets[sf] = data

            # ─── Build final datasets in CI3 order ───
            datasets = [{"name": "Downloaded", "data": downloaded_data}]
            for sf in status_flags:
                datasets.append({"name": sf, "data": flag_datasets[sf]})

            return datasets
        except Exception as e:
            logger.exception("Error in get_transcript_processed_data")
            return []

    @staticmethod
    def get_initial_kickouts_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get initial kickouts and processed data from DIGISCRIPT_BOT_LOG"""
        try:
            status_types = ['FAILED', 'PROCESSED']
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""

            datasets = []
            for status in status_types:
                if use_daily:
                    query = text(f"""
                        SELECT CAST(AUDIT_DATE AS DATE) as date, COUNT(*) as count
                        FROM {TBL_DIGISCRIPTBOTLOG}
                        WHERE UPDATED_BY = 'Transcript BOT'
                        AND ISNULL(ERROR_REASON, '') <> ''
                        AND UPPER(PROCESS_STATUS) = 'COMPLETE'
                        AND UPPER(TRANSCRIPT_STATUS_FLAG) = :status
                        AND CAST(AUDIT_DATE AS DATE) >= :fromdate
                        AND CAST(AUDIT_DATE AS DATE) <= :todate
                        {college_filter}
                        GROUP BY CAST(AUDIT_DATE AS DATE)
                        ORDER BY CAST(AUDIT_DATE AS DATE)
                    """)
                else:
                    query = text(f"""
                        SELECT YEAR(AUDIT_DATE) as year, MONTH(AUDIT_DATE) as month, COUNT(*) as count
                        FROM {TBL_DIGISCRIPTBOTLOG}
                        WHERE UPDATED_BY = 'Transcript BOT'
                        AND ISNULL(ERROR_REASON, '') <> ''
                        AND UPPER(PROCESS_STATUS) = 'COMPLETE'
                        AND UPPER(TRANSCRIPT_STATUS_FLAG) = :status
                        AND CAST(AUDIT_DATE AS DATE) >= :fromdate
                        AND CAST(AUDIT_DATE AS DATE) <= :todate
                        {college_filter}
                        GROUP BY YEAR(AUDIT_DATE), MONTH(AUDIT_DATE)
                        ORDER BY YEAR(AUDIT_DATE), MONTH(AUDIT_DATE)
                    """)

                result = db.execute(query, {
                    "fromdate": fromdate.split()[0],
                    "todate": todate.split()[0],
                    "status": status
                }).fetchall()

                data_map = {}
                for row in result:
                    if use_daily:
                        key = row.date.strftime('%Y-%m-%d')
                    else:
                        key = f"{row.year}-{row.month:02d}"
                    data_map[key] = row.count

                data = []
                for dr in date_ranges:
                    if use_daily:
                        key = dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        key = f"{dt.year}-{dt.month:02d}"
                    data.append(data_map.get(key, 0))

                datasets.append({
                    "name": status,
                    "data": data
                })

            return datasets
        except Exception as e:
            logger.exception("Error in get_initial_kickouts_data")
            return []

    @staticmethod
    def get_transcript_kickouts_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get transcript kickouts data (RERUN, FAILED)"""
        return SchoolDashboardModel.get_transcript_status_data(db, college_name, fromdate, todate, date_ranges, use_daily)

    @staticmethod
    def get_articulation_kickouts_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get articulation kickouts data"""
        try:
            status_types = ['FAILED', 'PROCESSED', 'PARTIALLY PROCESSED', 'PROCESSED & ROLLED', 'RERUN']
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""

            datasets = []
            for status in status_types:
                if use_daily:
                    query = text(f"""
                        SELECT CAST(LAST_UPDATED_DATETIME AS DATE) as date, COUNT(*) as count
                        FROM {TBL_KICKOUT}
                        WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID})
                        AND UPPER(TRANSCRIPT_STATUS_FLAG) = 'PROCESSED'
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                        AND UPPER(ARTICULATION_STATUS_FLAG) = :status
                        {college_filter}
                        GROUP BY CAST(LAST_UPDATED_DATETIME AS DATE)
                        ORDER BY CAST(LAST_UPDATED_DATETIME AS DATE)
                    """)
                else:
                    query = text(f"""
                        SELECT YEAR(LAST_UPDATED_DATETIME) as year, MONTH(LAST_UPDATED_DATETIME) as month, COUNT(*) as count
                        FROM {TBL_KICKOUT}
                        WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID})
                        AND UPPER(TRANSCRIPT_STATUS_FLAG) = 'PROCESSED'
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                        AND UPPER(ARTICULATION_STATUS_FLAG) = :status
                        {college_filter}
                        GROUP BY YEAR(LAST_UPDATED_DATETIME), MONTH(LAST_UPDATED_DATETIME)
                        ORDER BY YEAR(LAST_UPDATED_DATETIME), MONTH(LAST_UPDATED_DATETIME)
                    """)

                result = db.execute(query, {
                    "fromdate": fromdate.split()[0],
                    "todate": todate.split()[0],
                    "status": status.replace('&', '&')
                }).fetchall()

                data_map = {}
                for row in result:
                    if use_daily:
                        key = row.date.strftime('%Y-%m-%d')
                    else:
                        key = f"{row.year}-{row.month:02d}"
                    data_map[key] = row.count

                data = []
                for dr in date_ranges:
                    if use_daily:
                        key = dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        key = f"{dt.year}-{dt.month:02d}"
                    data.append(data_map.get(key, 0))

                datasets.append({
                    "name": status,
                    "data": data
                })

            return datasets
        except Exception as e:
            logger.exception("Error in get_articulation_kickouts_data")
            return []

    @staticmethod
    def get_articulation_courses_kickouts_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get articulation courses kickouts data"""
        try:
            status_types = ['FAILED', 'PROCESSED', 'RERUN']
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""

            datasets = []
            for status in status_types:
                if use_daily:
                    query = text(f"""
                        SELECT CAST(LAST_UPDATED_DATETIME AS DATE) as date, COUNT(*) as count
                        FROM {TBL_ARTICULATION}
                        WHERE CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                        AND UPPER(ARTICULATION_STATUS_FLAG) = :status
                        {college_filter}
                        GROUP BY CAST(LAST_UPDATED_DATETIME AS DATE)
                        ORDER BY CAST(LAST_UPDATED_DATETIME AS DATE)
                    """)
                else:
                    query = text(f"""
                        SELECT YEAR(LAST_UPDATED_DATETIME) as year, MONTH(LAST_UPDATED_DATETIME) as month, COUNT(*) as count
                        FROM {TBL_ARTICULATION}
                        WHERE CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                        AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                        AND UPPER(ARTICULATION_STATUS_FLAG) = :status
                        {college_filter}
                        GROUP BY YEAR(LAST_UPDATED_DATETIME), MONTH(LAST_UPDATED_DATETIME)
                        ORDER BY YEAR(LAST_UPDATED_DATETIME), MONTH(LAST_UPDATED_DATETIME)
                    """)

                result = db.execute(query, {
                    "fromdate": fromdate.split()[0],
                    "todate": todate.split()[0],
                    "status": status
                }).fetchall()

                data_map = {}
                for row in result:
                    if use_daily:
                        key = row.date.strftime('%Y-%m-%d')
                    else:
                        key = f"{row.year}-{row.month:02d}"
                    data_map[key] = row.count

                data = []
                for dr in date_ranges:
                    if use_daily:
                        key = dr
                    else:
                        dt = datetime.strptime(dr['StartDate'], '%Y-%m-%d')
                        key = f"{dt.year}-{dt.month:02d}"
                    data.append(data_map.get(key, 0))

                datasets.append({
                    "name": status,
                    "data": data
                })

            return datasets
        except Exception as e:
            logger.exception("Error in get_articulation_courses_kickouts_data")
            return []

    @staticmethod
    def get_transcript_status_donut(db: Session, college_name: str, fromdate: str, todate: str) -> Dict[str, Any]:
        """Get transcript status summary for donut chart"""
        try:
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""
            
            query = text(f"""
                SELECT 
                    UPPER(TRANSCRIPT_STATUS_FLAG) as status,
                    COUNT(*) as count
                FROM {TBL_KICKOUT}
                WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID})
                AND CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                {college_filter}
                GROUP BY UPPER(TRANSCRIPT_STATUS_FLAG)
            """)
            
            result = db.execute(query, {
                "fromdate": fromdate.split()[0],
                "todate": todate.split()[0]
            }).fetchall()
            
            labels = []
            series = []
            for row in result:
                labels.append(row.status)
                series.append(row.count)
            
            return {"labels": labels, "series": series}
        except Exception as e:
            logger.exception("Error in get_transcript_status_donut")
            return {"labels": [], "series": []}

    @staticmethod
    def get_articulation_status_donut(db: Session, college_name: str, fromdate: str, todate: str) -> Dict[str, Any]:
        """Get articulation status summary for donut chart"""
        try:
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""
            
            query = text(f"""
                SELECT 
                    UPPER(ARTICULATION_STATUS_FLAG) as status,
                    COUNT(*) as count
                FROM {TBL_KICKOUT}
                WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID})
                AND UPPER(TRANSCRIPT_STATUS_FLAG) = 'PROCESSED'
                AND CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                {college_filter}
                GROUP BY UPPER(ARTICULATION_STATUS_FLAG)
            """)
            
            result = db.execute(query, {
                "fromdate": fromdate.split()[0],
                "todate": todate.split()[0]
            }).fetchall()
            
            labels = []
            series = []
            for row in result:
                labels.append(row.status)
                series.append(row.count)
            
            return {"labels": labels, "series": series}
        except Exception as e:
            logger.exception("Error in get_articulation_status_donut")
            return {"labels": [], "series": []}

    @staticmethod
    def get_articulation_courses_status_donut(db: Session, college_name: str, fromdate: str, todate: str) -> Dict[str, Any]:
        """Get articulation courses status summary for donut chart"""
        try:
            college_filter = f" AND INSTITUTION_ID = '{college_name}'" if college_name else ""
            
            query = text(f"""
                SELECT 
                    UPPER(ARTICULATION_STATUS_FLAG) as status,
                    COUNT(*) as count
                FROM {TBL_ARTICULATION}
                WHERE CAST(LAST_UPDATED_DATETIME AS DATE) >= :fromdate
                AND CAST(LAST_UPDATED_DATETIME AS DATE) <= :todate
                {college_filter}
                GROUP BY UPPER(ARTICULATION_STATUS_FLAG)
            """)
            
            result = db.execute(query, {
                "fromdate": fromdate.split()[0],
                "todate": todate.split()[0]
            }).fetchall()
            
            labels = []
            series = []
            for row in result:
                labels.append(row.status)
                series.append(row.count)
            
            return {"labels": labels, "series": series}
        except Exception as e:
            logger.exception("Error in get_articulation_courses_status_donut")
            return {"labels": [], "series": []}

    @staticmethod
    def get_colleges_list(db: Session, search_term: str = "") -> List[Dict[str, str]]:
        """Get list of colleges for filter dropdown"""
        try:
            like_condition = ""
            if search_term:
                like_condition = f" AND (LOWER(INSTITUTION_NAME) LIKE '%{search_term.lower()}%' OR INSTITUTION_ID LIKE '%{search_term}%')"
            
            query = text(f"""
                SELECT DISTINCT INSTITUTION_NAME, INSTITUTION_ID
                FROM {TBL_INSTITUTION_MAPPING}
                WHERE INSTITUTION_ID IN (
                    SELECT DISTINCT INSTITUTION_ID
                    FROM {TBL_KICKOUT}
                    WHERE (PROJECT_ID = {SCHOOL_PROJECT_ID})
                )
                AND INSTITUTION_ID != '000000'
                {like_condition}
                ORDER BY INSTITUTION_NAME
            """)
            
            result = db.execute(query).fetchall()
            
            colleges = []
            for row in result:
                colleges.append({
                    "INSTITUTION_NAME": row.INSTITUTION_NAME,
                    "INSTITUTION_ID": row.INSTITUTION_ID
                })
            
            return colleges
        except Exception as e:
            logger.exception("Error in get_colleges_list")
            return []



