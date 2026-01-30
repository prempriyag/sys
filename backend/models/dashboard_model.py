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
    TBL_DIGISCRIPTBOTLOG
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
        Matches CI3 transcript_SAAADMS_dashboard() method
        Queries DIGISCRIPT_LOG (TBL_KICKOUT) for STATUS_SOAPCOL, STATUS_SHATAEQ, STATUS_BDMS
        """
        try:
            status_flags = ['SOAPCOL', 'SHATAEQ', 'BDMS']
            college_filter = f" AND (t.INSTITUTION_ID = '{college_name}')" if college_name else ""
            
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
            for status_flag in status_flags:
                # Build SQL columns for each status flag
                sql_col = f"ISNULL(SUM(CASE WHEN UPPER(t.STATUS_{status_flag}) = 'PROCESSED' THEN 1 ELSE 0 END), 0) AS {status_flag}Count"
                
                if use_daily:
                    query = text(f"""
                        SELECT 
                            month_data.date AS date,
                            {sql_col}
                        FROM
                            (VALUES {date_values}) AS month_data(date)
                        LEFT JOIN
                            {TBL_KICKOUT} AS t 
                            ON CAST(t.LAST_UPDATED_DATETIME AS DATE) = CAST(month_data.date AS DATE)
                            AND (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR ISNULL(t.PROJECT_ID, '') = '')
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
                            {sql_col}
                        FROM 
                            (VALUES {date_values}) AS month_data(date)
                        LEFT JOIN 
                            {TBL_KICKOUT} AS t 
                            ON MONTH(t.LAST_UPDATED_DATETIME) = MONTH(CAST(month_data.date AS DATE))
                            AND YEAR(t.LAST_UPDATED_DATETIME) = YEAR(CAST(month_data.date AS DATE))
                            AND (t.PROJECT_ID = {COLLEGE_PROJECT_ID} OR ISNULL(t.PROJECT_ID, '') = '')
                            AND CAST(t.LAST_UPDATED_DATETIME AS DATE) BETWEEN '{first_start_date}' AND '{last_end_date}'
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
                    # Get count from the status flag column
                    count_attr = f"{status_flag}Count"
                    count = row[-1] if isinstance(row, tuple) else (getattr(row, count_attr, 0) if hasattr(row, count_attr) else row[-1])
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
                    "name": status_flag,
                    "data": data
                })

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
                    WHERE (PROJECT_ID = {COLLEGE_PROJECT_ID} OR PROJECT_ID IS NULL)
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



