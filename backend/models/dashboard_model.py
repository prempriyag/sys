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
    COLLEGE_PROJECT_ID, TBL_INSTITUTION_MAPPING,
    TBL_DIGISCRIPTBOTLOG, TBL_TRANSCRIPTHDROCR,
    TBL_TRANSCRIPTHDRDATA
)

logger = logging.getLogger(__name__)


class DashboardModel:
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
                date_ranges = DashboardModel.get_days_list(fromdate, todate)
                labels = [datetime.strptime(d, '%Y-%m-%d').strftime('%d %b') for d in date_ranges]
            else:
                date_ranges = DashboardModel.get_months_slab(fromdate, todate)
                labels = [datetime.strptime(r['StartDate'], '%Y-%m-%d').strftime('%b %Y') for r in date_ranges]

            # Build filter condition
            college_filter = ""
            if college_name:
                college_filter = f" AND INSTITUTION_ID = '{college_name}'"

            # Get transcript sources data
            transcript_sources = DashboardModel.get_transcript_sources_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get transcript status data
            transcript_status = DashboardModel.get_transcript_status_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get transcript processed data
            transcript_processed = DashboardModel.get_transcript_processed_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get initial kickouts data
            initial_kickouts = DashboardModel.get_initial_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get transcript kickouts data
            transcript_kickouts = DashboardModel.get_transcript_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get articulation kickouts data
            articulation_kickouts = DashboardModel.get_articulation_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get articulation courses kickouts data
            articulation_courses_kickouts = DashboardModel.get_articulation_courses_kickouts_data(
                db, college_name, fromdate, todate, date_ranges, use_daily
            )

            # Get donut chart data
            transcript_status_donut = DashboardModel.get_transcript_status_donut(db, college_name, fromdate, todate)
            articulation_status_donut = DashboardModel.get_articulation_status_donut(db, college_name, fromdate, todate)
            articulation_courses_status_donut = DashboardModel.get_articulation_courses_status_donut(db, college_name, fromdate, todate)

            # Get download-level distribution reports (Advanced Dashboard)
            source_type_distribution = DashboardModel.get_source_type_distribution(db, college_name, fromdate, todate)
            download_status_distribution = DashboardModel.get_download_status_distribution(db, college_name, fromdate, todate)

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
                "sourceTypeDistribution": source_type_distribution,
                "downloadStatusDistribution": download_status_distribution,
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
                        WHERE (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR t.PROJECT_ID IS NULL)
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
                        WHERE (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR t.PROJECT_ID IS NULL)
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
                        WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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
                        WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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
        """Get transcripts processed in Banner
        Matches CI3 college_transcript_status_data section:
          - Downloaded   (transcript_download_dashboard)
          - SOAPCOL      (transcript_SAAADMS_dashboard)
          - SHATAEQ      (transcript_SAAADMS_dashboard)
          - BDMS         (transcript_SAAADMS_dashboard)
          - Rerun        (transcript_kickout_dashboard)
          - Failed       (transcript_kickout_dashboard)
        """
        try:
            all_names = ['Downloaded', 'SOAPCOL', 'SHATAEQ', 'BDMS', 'Rerun', 'Failed']
            if not date_ranges:
                return [{"name": n, "data": []} for n in all_names]

            status_flags = ['SOAPCOL', 'SHATAEQ', 'BDMS']
            college_filter_t = f" AND (t.INSTITUTION_ID = '{college_name}')" if college_name else ""
            college_filter_d = f" AND d.INSTITUTION_ID = '{college_name}'" if college_name else ""

            first_start_date = fromdate.split()[0]
            last_end_date = todate.split()[0]

            # Build date values for SQL VALUES clause
            if use_daily:
                date_values = ", ".join([f"('{dr}')" for dr in date_ranges])
            else:
                date_values = ", ".join([f"('{dr['StartDate']}')" for dr in date_ranges])
                first_start_date = date_ranges[0]['StartDate']
                last_end_date = date_ranges[-1]['EndDate']

            # ── helper to map results to date_ranges ──
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

            # ─── 1. Downloaded (CI3 transcript_download_dashboard) ───
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
                        AND (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR ISNULL(t.PROJECT_ID, '') = '')
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
                        AND (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR ISNULL(t.PROJECT_ID, '') = '')
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

            # ─── 2. SOAPCOL / SHATAEQ / BDMS (CI3 transcript_SAAADMS_dashboard) ───
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
                        AND (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR ISNULL(t.PROJECT_ID, '') = '')
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
                        AND (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR ISNULL(t.PROJECT_ID, '') = '')
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

            # Build result_map for SAAADMS data
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

            # ─── 3. Rerun & Failed (CI3 transcript_kickout_dashboard) ───
            kickout_cols = f"""
                ISNULL(SUM(CASE WHEN UPPER(t.TRANSCRIPT_STATUS_FLAG)='RERUN' THEN 1 ELSE 0 END),0) AS RERUN_data,
                ISNULL(SUM(CASE WHEN UPPER(t.TRANSCRIPT_STATUS_FLAG)='FAILED'
                    AND (
                        ISNULL(t.ERROR_REASON,'') LIKE 'Error while entering details into SAAADMS.%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'Error while processing%BDMS uploa%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'Got an error while processing Banner%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'Banner not saved while entering Col%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'BOT encountered a technical error%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'Banner not saved while entering high school detail%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'OSU-OKC Institution Code not found and the Institution Name is%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'Institution GPA Scale is missing%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'Weighted (or) UnWeighted GPA value%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'OSU-OKC Degree was not found for Degree%'
                        OR ISNULL(t.ERROR_REASON,'') LIKE 'No subjects are available in SHRTATC%'
                        OR ISNULL(t.ERROR_REASON,'') = ''
                    ) THEN 1 ELSE 0 END),0) AS FAILED_data
            """

            if use_daily:
                ko_query = text(f"""
                    SELECT
                        month_data.date AS date,
                        {kickout_cols}
                    FROM (VALUES {date_values}) AS month_data(date)
                    LEFT JOIN {TBL_KICKOUT} AS t
                        ON CAST(t.LAST_UPDATED_DATETIME AS DATE) = month_data.date
                        AND t.PROJECT_ID = {COLLEGE_PROJECT_ID}
                        {college_filter_t}
                    GROUP BY month_data.date
                    ORDER BY month_data.date
                """)
            else:
                ko_query = text(f"""
                    SELECT
                        LEFT(DATENAME(month, month_data.date), 3) AS month,
                        YEAR(month_data.date) AS year,
                        DATEPART(MM, month_data.date) AS mth,
                        {kickout_cols}
                    FROM (VALUES {date_values}) AS month_data(date)
                    LEFT JOIN {TBL_KICKOUT} AS t
                        ON MONTH(t.LAST_UPDATED_DATETIME) = MONTH(month_data.date)
                        AND YEAR(t.LAST_UPDATED_DATETIME) = YEAR(month_data.date)
                        AND t.PROJECT_ID = {COLLEGE_PROJECT_ID}
                        AND CAST(t.LAST_UPDATED_DATETIME AS DATE) BETWEEN '{first_start_date}' AND '{last_end_date}'
                        {college_filter_t}
                    GROUP BY DATENAME(month, month_data.date), YEAR(month_data.date), DATEPART(MM, month_data.date)
                    ORDER BY YEAR(month_data.date), DATEPART(MM, month_data.date)
                """)

            ko_rows = db.execute(ko_query).fetchall()
            rerun_data = _map_rows(ko_rows, 'RERUN_data')
            failed_data = _map_rows(ko_rows, 'FAILED_data')

            # ─── Build final datasets in CI3 order ───
            datasets = [
                {"name": "Downloaded", "data": downloaded_data},
                {"name": "SOAPCOL",    "data": flag_datasets['SOAPCOL']},
                {"name": "SHATAEQ",    "data": flag_datasets['SHATAEQ']},
                {"name": "BDMS",       "data": flag_datasets['BDMS']},
                {"name": "Rerun",      "data": rerun_data},
                {"name": "Failed",     "data": failed_data},
            ]

            return datasets
        except Exception as e:
            logger.exception("Error in get_transcript_processed_data")
            return []

    @staticmethod
    def get_initial_kickouts_data(
        db: Session, college_name: str, fromdate: str, todate: str,
        date_ranges: List, use_daily: bool
    ) -> List[Dict[str, Any]]:
        """Get initial kickouts and processed data
        Matches CI3 initial_transcripts_dashboard() method
        Queries DIGISCRIPT_BOT_LOG with TRANSCRIPT_STATUS_FLAG filter
        """
        try:
            status_types = ['FAILED', 'PROCESSED']
            college_filter = f" AND (t.INSTITUTION_ID = '{college_name}' OR t.INSTITUTION_ID IS NULL)" if college_name else ""
            
            first_start_date = fromdate.split()[0]
            last_end_date = todate.split()[0]
            
            if use_daily:
                # date_ranges is a list of date strings
                date_values = ", ".join([f"('{dr}')" for dr in date_ranges])
            else:
                # date_ranges is a list of dicts with StartDate
                date_values = ", ".join([f"('{dr['StartDate']}')" for dr in date_ranges])
                if date_ranges:
                    first_start_date = date_ranges[0]['StartDate']
                    last_end_date = date_ranges[-1]['EndDate']

            datasets = []
            for status in status_types:
                if use_daily:
                    query = text(f"""
                        SELECT 
                            month_data.date AS date,
                            ISNULL(SUM(CASE WHEN UPPER(t.TRANSCRIPT_STATUS_FLAG) = '{status}' THEN 1 ELSE 0 END), 0) AS count
                        FROM
                            (VALUES {date_values}) AS month_data(date)
                        LEFT JOIN
                            {TBL_DIGISCRIPTBOTLOG} AS t 
                            ON CAST(t.AUDIT_DATE AS DATE) = CAST(month_data.date AS DATE)
                            AND t.UPDATED_BY = 'Transcript BOT'
                            AND ISNULL(t.ERROR_REASON, '') <> ''
                            AND UPPER(t.PROCESS_STATUS) = 'COMPLETE'
                            {college_filter}
                        GROUP BY 
                            month_data.date
                        ORDER BY 
                            month_data.date
                    """)
                else:
                    query = text(f"""
                        SELECT 
                            LEFT(DATENAME(month, CAST(month_data.date AS DATE)), 3) AS month,
                            YEAR(CAST(month_data.date AS DATE)) AS year,
                            DATEPART(MM, CAST(month_data.date AS DATE)) AS mth,
                            ISNULL(SUM(CASE WHEN UPPER(t.TRANSCRIPT_STATUS_FLAG) = '{status}' THEN 1 ELSE 0 END), 0) AS count
                        FROM 
                            (VALUES {date_values}) AS month_data(date)
                        LEFT JOIN 
                            {TBL_DIGISCRIPTBOTLOG} AS t 
                            ON MONTH(t.AUDIT_DATE) = MONTH(CAST(month_data.date AS DATE))
                            AND YEAR(t.AUDIT_DATE) = YEAR(CAST(month_data.date AS DATE))
                            AND t.UPDATED_BY = 'Transcript BOT'
                            AND ISNULL(t.ERROR_REASON, '') <> ''
                            AND UPPER(t.PROCESS_STATUS) = 'COMPLETE'
                            AND CAST(t.AUDIT_DATE AS DATE) BETWEEN '{first_start_date}' AND '{last_end_date}'
                            {college_filter}
                        GROUP BY 
                            DATENAME(month, CAST(month_data.date AS DATE)), 
                            YEAR(CAST(month_data.date AS DATE)), 
                            DATEPART(MM, CAST(month_data.date AS DATE)),
                            month_data.date
                        ORDER BY 
                            YEAR(CAST(month_data.date AS DATE)), 
                            DATEPART(MM, CAST(month_data.date AS DATE))
                    """)

                result = db.execute(query).fetchall()

                data_map = {}
                for row in result:
                    if use_daily:
                        date_val = row[0] if isinstance(row, tuple) else (row.date if hasattr(row, 'date') else row[0])
                        if hasattr(date_val, 'strftime'):
                            key = date_val.strftime('%Y-%m-%d')
                        else:
                            key = str(date_val)[:10]  # Take first 10 chars for date
                    else:
                        year = row[1] if isinstance(row, tuple) else (row.year if hasattr(row, 'year') else row[1])
                        mth = row[2] if isinstance(row, tuple) else (row.mth if hasattr(row, 'mth') else row[2])
                        key = f"{year}-{mth:02d}"
                    count = row[-1] if isinstance(row, tuple) else (row.count if hasattr(row, 'count') else row[-1])
                    data_map[key] = count

                data = []
                for dr in date_ranges:
                    if use_daily:
                        key = dr[:10] if len(dr) > 10 else dr
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
        return DashboardModel.get_transcript_status_data(db, college_name, fromdate, todate, date_ranges, use_daily)

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
                        WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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
                        WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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
                WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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
                WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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
    def get_source_type_distribution(
        db: Session, college_name: str, fromdate: str, todate: str
    ) -> Dict[str, Any]:
        """
        Get transcript count grouped by SOURCE_TYPE from TRANSCRIPT_DOWNLOAD.
        SQL: SELECT SOURCE_TYPE, COUNT(SOURCE_TYPE) FROM TRANSCRIPT_DOWNLOAD
             WHERE PROJECT_ID = 2 AND CAST(UPLOADED_DATETIME AS DATE) BETWEEN ... GROUP BY SOURCE_TYPE
        """
        try:
            college_filter = ""
            if college_name:
                college_filter = f" AND d.INSTITUTION_ID = '{college_name}'"

            query = text(f"""
                SELECT 
                    t.SOURCE_TYPE,
                    COUNT(t.SOURCE_TYPE) AS cnt
                FROM {TBL_DOWNLOAD} t
                LEFT JOIN {TBL_KICKOUT} d ON d.BATCH_ID = t.BATCH_ID
                WHERE (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR t.PROJECT_ID IS NULL)
                AND CAST(t.UPLOADED_DATETIME AS DATE) >= :fromdate
                AND CAST(t.UPLOADED_DATETIME AS DATE) <= :todate
                {college_filter}
                GROUP BY t.SOURCE_TYPE
            """)

            result = db.execute(query, {
                "fromdate": fromdate.split()[0],
                "todate": todate.split()[0],
            }).fetchall()

            labels = []
            series = []
            for row in result:
                source = row.SOURCE_TYPE if row.SOURCE_TYPE else "Unknown"
                labels.append(source)
                series.append(row.cnt)

            return {"labels": labels, "series": series}
        except Exception as e:
            logger.exception("Error in get_source_type_distribution")
            return {"labels": [], "series": []}

    @staticmethod
    def get_download_status_distribution(
        db: Session, college_name: str, fromdate: str, todate: str
    ) -> Dict[str, Any]:
        """
        Get transcript count grouped by STATUS from TRANSCRIPT_DOWNLOAD.
        SQL: SELECT STATUS, COUNT(STATUS) FROM TRANSCRIPT_DOWNLOAD
             WHERE PROJECT_ID = 2 AND CAST(UPLOADED_DATETIME AS DATE) BETWEEN ... GROUP BY STATUS
        """
        try:
            college_filter = ""
            if college_name:
                college_filter = f" AND d.INSTITUTION_ID = '{college_name}'"

            query = text(f"""
                SELECT 
                    t.STATUS AS Status,
                    COUNT(t.STATUS) AS cnt
                FROM {TBL_DOWNLOAD} t
                LEFT JOIN {TBL_KICKOUT} d ON d.BATCH_ID = t.BATCH_ID
                WHERE (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR t.PROJECT_ID IS NULL)
                AND CAST(t.UPLOADED_DATETIME AS DATE) >= :fromdate
                AND CAST(t.UPLOADED_DATETIME AS DATE) <= :todate
                {college_filter}
                GROUP BY t.STATUS
            """)

            result = db.execute(query, {
                "fromdate": fromdate.split()[0],
                "todate": todate.split()[0],
            }).fetchall()

            labels = []
            series = []
            for row in result:
                status = row.Status if row.Status else "Unknown"
                labels.append(status)
                series.append(row.cnt)

            return {"labels": labels, "series": series}
        except Exception as e:
            logger.exception("Error in get_download_status_distribution")
            return {"labels": [], "series": []}

    # ──────────────────────────────────────────────────────────────────
    # Recon Report methods
    # ──────────────────────────────────────────────────────────────────

    @staticmethod
    def get_recon_report(
        db: Session,
        fromdate: str,
        todate: str,
        project_id: int = COLLEGE_PROJECT_ID,
    ) -> Dict[str, Any]:
        """
        Get full reconciliation report data.
        Runs all recon queries and returns structured data.
        """
        try:
            return {
                "transcriptStatusByProject": DashboardModel._recon_transcript_status(db, fromdate, todate, project_id),
                "articulationStatusByProject": DashboardModel._recon_articulation_status(db, fromdate, todate, project_id),
                "transcriptErrorCategories": DashboardModel._recon_transcript_errors(db, fromdate, todate, project_id),
                "downloadStatus": DashboardModel._recon_download_status(db, fromdate, todate, project_id),
                "ocrStatus": DashboardModel._recon_ocr_status(db, fromdate, todate, project_id),
                "hdrDataStatus": DashboardModel._recon_hdr_data_status(db, fromdate, todate, project_id),
                "hdrDataAfterOcrSuccess": DashboardModel._recon_hdr_data_after_ocr(db, fromdate, todate, project_id),
                "downloadSourceStatus": DashboardModel._recon_download_source_status(db, fromdate, todate, project_id),
                "articulationErrorCategories": DashboardModel._recon_articulation_errors(db, fromdate, todate, project_id),
            }
        except Exception as e:
            logger.exception("Error in get_recon_report")
            raise

    @staticmethod
    def _recon_transcript_status(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q1: DIGISCRIPT_LOG – TRANSCRIPT_STATUS_FLAG counts"""
        try:
            query = text(f"""
                SELECT
                    TRANSCRIPT_STATUS_FLAG,
                    COUNT(*) AS StatusCount
                FROM {TBL_KICKOUT}
                WHERE PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY TRANSCRIPT_STATUS_FLAG
                ORDER BY TRANSCRIPT_STATUS_FLAG ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"status": r.TRANSCRIPT_STATUS_FLAG or "Unknown", "count": r.StatusCount} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_transcript_status")
            return []

    @staticmethod
    def _recon_articulation_status(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q2: DIGISCRIPT_LOG – ARTICULATION_STATUS_FLAG counts"""
        try:
            query = text(f"""
                SELECT
                    ARTICULATION_STATUS_FLAG,
                    COUNT(*) AS StatusCount
                FROM {TBL_KICKOUT}
                WHERE PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY ARTICULATION_STATUS_FLAG
                ORDER BY ARTICULATION_STATUS_FLAG ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"status": r.ARTICULATION_STATUS_FLAG or "Unknown", "count": r.StatusCount} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_articulation_status")
            return []

    @staticmethod
    def _recon_transcript_errors(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q3: DIGISCRIPT_LOG – Error categories for FAILED transcripts"""
        try:
            query = text(f"""
                SELECT
                    CASE
                        WHEN CHARINDEX('-', ERROR_REASON) > 0
                        THEN LEFT(ERROR_REASON, CHARINDEX('-', ERROR_REASON) - 1)
                        ELSE ERROR_REASON
                    END AS ERROR_CATEGORY,
                    MIN(ERROR_REASON) AS ErrorReason,
                    COUNT(BATCH_ID) AS ErrorCount
                FROM {TBL_KICKOUT}
                WHERE UPPER(TRANSCRIPT_STATUS_FLAG) = 'FAILED'
                AND PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY
                    CASE
                        WHEN CHARINDEX('-', ERROR_REASON) > 0
                        THEN LEFT(ERROR_REASON, CHARINDEX('-', ERROR_REASON) - 1)
                        ELSE ERROR_REASON
                    END
                ORDER BY ErrorCount DESC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"category": r.ERROR_CATEGORY or "Unknown", "reason": r.ErrorReason or "", "count": r.ErrorCount} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_transcript_errors")
            return []

    @staticmethod
    def _recon_download_status(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q4: TRANSCRIPT_DOWNLOAD – STATUS counts"""
        try:
            query = text(f"""
                SELECT
                    STATUS AS TRANSCRIPT_STATUS_FLAG,
                    COUNT(*) AS data_Count
                FROM {TBL_DOWNLOAD}
                WHERE PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY STATUS
                ORDER BY STATUS ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"status": r.TRANSCRIPT_STATUS_FLAG or "Unknown", "count": r.data_Count} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_download_status")
            return []

    @staticmethod
    def _recon_ocr_status(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q5: TRANSCRIPT_HDR_OCR – STATUS_FLAG counts"""
        try:
            query = text(f"""
                SELECT
                    STATUS_FLAG AS TRANSCRIPT_STATUS_FLAG,
                    COUNT(*) AS data_Count
                FROM {TBL_TRANSCRIPTHDROCR}
                WHERE PROJECT_ID = :pid
                AND CAST(OCR_EXTRACTED_DATE AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY STATUS_FLAG
                ORDER BY STATUS_FLAG ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"status": r.TRANSCRIPT_STATUS_FLAG or "Unknown", "count": r.data_Count} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_ocr_status")
            return []

    @staticmethod
    def _recon_hdr_data_status(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q6: TRANSCRIPT_HDR_DATA – STATUS_FLAG counts"""
        try:
            query = text(f"""
                SELECT
                    STATUS_FLAG AS TRANSCRIPT_STATUS_FLAG,
                    COUNT(*) AS data_Count
                FROM {TBL_TRANSCRIPTHDRDATA}
                WHERE PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY STATUS_FLAG
                ORDER BY STATUS_FLAG ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"status": r.TRANSCRIPT_STATUS_FLAG or "Unknown", "count": r.data_Count} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_hdr_data_status")
            return []

    @staticmethod
    def _recon_hdr_data_after_ocr(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q7: TRANSCRIPT_HDR_DATA – STATUS_FLAG counts WHERE BATCH_ID in OCR SUCCESS"""
        try:
            query = text(f"""
                SELECT
                    STATUS_FLAG AS TRANSCRIPT_STATUS_FLAG,
                    COUNT(STATUS_FLAG) AS data_Count
                FROM {TBL_TRANSCRIPTHDRDATA}
                WHERE PROJECT_ID = :pid
                AND BATCH_ID IN (
                    SELECT BATCH_ID
                    FROM {TBL_TRANSCRIPTHDROCR}
                    WHERE UPPER(STATUS_FLAG) = 'SUCCESS'
                )
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY STATUS_FLAG
                ORDER BY STATUS_FLAG ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"status": r.TRANSCRIPT_STATUS_FLAG or "Unknown", "count": r.data_Count} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_hdr_data_after_ocr")
            return []

    @staticmethod
    def _recon_download_source_status(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q8: TRANSCRIPT_DOWNLOAD – SOURCE_TYPE + STATUS cross-tab"""
        try:
            query = text(f"""
                SELECT
                    SOURCE_TYPE,
                    STATUS AS TRANSCRIPT_STATUS_FLAG,
                    COUNT(STATUS) AS data_Count
                FROM {TBL_DOWNLOAD}
                WHERE PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY SOURCE_TYPE, STATUS
                ORDER BY SOURCE_TYPE, STATUS ASC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"sourceType": r.SOURCE_TYPE or "Unknown", "status": r.TRANSCRIPT_STATUS_FLAG or "Unknown", "count": r.data_Count} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_download_source_status")
            return []

    @staticmethod
    def _recon_articulation_errors(db: Session, fromdate: str, todate: str, project_id: int) -> List[Dict]:
        """Q9: DIGISCRIPT_LOG – Articulation error categories (PROCESSED transcript + FAILED/PARTIALLY PROCESSED articulation)"""
        try:
            query = text(f"""
                SELECT
                    CASE
                        WHEN CHARINDEX('-', ERROR_REASON) > 0
                        THEN LEFT(ERROR_REASON, CHARINDEX('-', ERROR_REASON) - 1)
                        ELSE ERROR_REASON
                    END AS ERROR_CATEGORY,
                    MIN(ERROR_REASON) AS ErrorReason,
                    COUNT(BATCH_ID) AS ErrorCount
                FROM {TBL_KICKOUT}
                WHERE UPPER(TRANSCRIPT_STATUS_FLAG) = 'PROCESSED'
                AND (UPPER(ARTICULATION_STATUS_FLAG) = 'FAILED' OR UPPER(ARTICULATION_STATUS_FLAG) = 'PARTIALLY PROCESSED')
                AND PROJECT_ID = :pid
                AND CAST(LAST_UPDATED_DATETIME AS DATETIME) BETWEEN :fromdate AND :todate
                GROUP BY
                    CASE
                        WHEN CHARINDEX('-', ERROR_REASON) > 0
                        THEN LEFT(ERROR_REASON, CHARINDEX('-', ERROR_REASON) - 1)
                        ELSE ERROR_REASON
                    END
                ORDER BY ErrorCount DESC
            """)
            rows = db.execute(query, {"pid": project_id, "fromdate": fromdate, "todate": todate}).fetchall()
            return [{"category": r.ERROR_CATEGORY or "Unknown", "reason": r.ErrorReason or "", "count": r.ErrorCount} for r in rows]
        except Exception as e:
            logger.exception("Error in _recon_articulation_errors")
            return []

    @staticmethod
    def get_colleges_list(db: Session, search_term: str = "") -> List[Dict[str, str]]:
        """Get list of colleges for filter dropdown.
        First tries institutions that have kickout activity; if empty, falls back to all from INSTITUTION_MAPPING.
        """
        try:
            like_condition = ""
            if search_term:
                safe_term = search_term.strip().replace("'", "''")
                like_condition = f" AND (LOWER(INSTITUTION_NAME) LIKE LOWER('%{safe_term}%') OR CAST(INSTITUTION_ID AS VARCHAR) LIKE '%{safe_term}%')"

            # Try institutions that have kickout activity for college project
            query = text(f"""
                SELECT DISTINCT m.INSTITUTION_NAME, m.INSTITUTION_ID
                FROM {TBL_INSTITUTION_MAPPING} m
                WHERE m.INSTITUTION_ID IN (
                    SELECT DISTINCT INSTITUTION_ID
                    FROM {TBL_KICKOUT}
                    WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
                )
                AND m.INSTITUTION_ID != '000000'
                {like_condition}
                ORDER BY m.INSTITUTION_NAME
            """)
            result = db.execute(query).fetchall()
            colleges = [{"INSTITUTION_NAME": row.INSTITUTION_NAME, "INSTITUTION_ID": row.INSTITUTION_ID} for row in result]

            # Fallback: if no institutions from kickout, return all from INSTITUTION_MAPPING
            if not colleges:
                fallback_query = text(f"""
                    SELECT DISTINCT INSTITUTION_NAME, INSTITUTION_ID
                    FROM {TBL_INSTITUTION_MAPPING}
                    WHERE INSTITUTION_ID != '000000'
                    {like_condition}
                    ORDER BY INSTITUTION_NAME
                """)
                fallback_result = db.execute(fallback_query).fetchall()
                colleges = [{"INSTITUTION_NAME": row.INSTITUTION_NAME, "INSTITUTION_ID": row.INSTITUTION_ID} for row in fallback_result]

            return colleges
        except Exception as e:
            logger.exception("Error in get_colleges_list")
            return []



