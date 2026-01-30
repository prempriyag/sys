"""
Student View Controller
Based on CI3 Studentview controller
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from database.connection import get_db
from helpers.security_helper import get_current_user
from helpers.common_helper import check_special_name
from models.user import User
from models.transcript_reports_model import TranscriptReportsModel
from models.articulation_reports_model import ArticulationReportsModel
from config.constants import (
    COLLEGE_PROJECT_ID,
    TBL_TRANSCRIPTHDRDATA,
    TBL_INSTITUTION_MAPPING,
    TBL_KICKOUT,
    TBL_BANNER_APPLICANT_DATA,
)

router = APIRouter(prefix="/api/studentview", tags=["studentview"])


class StudentListResponse(BaseModel):
    STUDENT_ID: str
    STUDENT_FULL_NAME: str


class ViewPageLoadRequest(BaseModel):
    type: str
    student_id: str
    batch_id: Optional[str] = None
    institution_id: Optional[str] = None
    studnet_view_name: Optional[str] = None


@router.get("/", response_model=Dict[str, Any])
async def index(
    student_id: Optional[str] = Query(None),
    batch_id: Optional[str] = Query(None),
    institution_id: Optional[str] = Query(None),
    report_type: Optional[str] = Query(None, alias="type"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Main student view page - returns student info, institutions, batches, and status counts.
    Matches: CI3 Studentview::index() (application/controllers/Studentview.php)
    Uses TranscriptReportsModel and ArticulationReportsModel to get counts (same as CI3).
    """
    response_data = {}
    institution_name = []
    status_flags_list = []
    batch_details = {}
    total_transcripts = 0
    student_info = None

    if student_id:
        # Clean and prepare student_id for query (matching CI3 checkspecialname)
        student_id_clean = check_special_name(student_id.lower().strip())
        student_id_decoded = student_id_clean  # urldecode already handled by FastAPI
        
        # Build where clause matching CI3 exactly
        where_clause = f"(lower(t.STUDENT_ID)='{student_id_decoded}' OR lower(t.STUDENT_FULL_NAME) like '%{student_id_decoded}%')"
        
        # Determine if numeric (matching CI3 logic)
        is_numeric = student_id.strip().isdigit()
        
        if is_numeric:
            val_data = "t.STUDENT_FULL_NAME, t.STUDENT_ID, t.INSTITUTION_ID, MAX(m.INSTITUTION_NAME) as INSTITUTION_NAME"
            group_by = "t.INSTITUTION_ID, t.STUDENT_FULL_NAME, t.STUDENT_ID"
        else:
            val_data = "t.STUDENT_FULL_NAME, t.INSTITUTION_ID, MAX(m.INSTITUTION_NAME) as INSTITUTION_NAME"
            group_by = "t.INSTITUTION_ID, t.STUDENT_FULL_NAME"

        # Query institutions (matching CI3 lines 39-45)
        sql = f"""
        SELECT {val_data}
        FROM {TBL_TRANSCRIPTHDRDATA} as t WITH(NOLOCK)
        LEFT JOIN {TBL_INSTITUTION_MAPPING} as m WITH(NOLOCK) ON t.INSTITUTION_ID = m.INSTITUTION_ID
        WHERE {where_clause}
        GROUP BY {group_by}
        """
        # print("81:",sql)
        try:
            result = db.execute(text(sql))
            institution_name = [dict(row._mapping) for row in result]
            print(f"[StudentView] Found {len(institution_name)} institutions for student: {student_id}")
        except Exception as e:
            print(f"[StudentView] Error querying institutions: {e}")
            import traceback
            traceback.print_exc()
            institution_name = []

        # Get batch details and status counts for each institution (matching CI3 lines 52-98)
        ins_where = f"(lower(k.STUDENT_ID)='{student_id_decoded}' OR lower(k.STUDENT_FULL_NAME) like '%{student_id_decoded}%')"
        
        # Store batch metadata (OCR_EXTRACTED_DATE, LAST_UPDATED_DATETIME)
        batch_metadata = {}  # {institution_id: {batch_id: {OCR_EXTRACTED_DATE: ..., LAST_UPDATED_DATETIME: ...}}}
        
        for ins in institution_name:
            ins_id = ins.get('INSTITUTION_ID')
            if not ins_id:
                continue

            # Get batch IDs for this institution and student (matching CI3 lines 53-60)
            batch_sql = f"""
            SELECT DISTINCT k.BATCH_ID
            FROM {TBL_KICKOUT} as k WITH(NOLOCK)
            LEFT JOIN {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK) ON h.BATCH_ID = k.BATCH_ID
            WHERE {ins_where}
            AND k.INSTITUTION_ID = '{ins_id}'
            AND k.PROJECT_ID = {COLLEGE_PROJECT_ID}
            """
            
            try:
                batch_result = db.execute(text(batch_sql))
                batch_ids = [row[0] for row in batch_result if row[0]]
                print(f"[StudentView] Found {len(batch_ids)} batches for institution {ins_id}")
            except Exception as e:
                print(f"[StudentView] Error querying batches for institution {ins_id}: {e}")
                batch_ids = []

            batch_inside = []  # Batches with status counts > 0
            
            # If no batches found in KICKOUT, also check TRANSCRIPT_HDR_DATA for batches (matching CI3 line 56-57 LEFT JOIN)
            if not batch_ids:
                # Try to get batches from TRANSCRIPT_HDR_DATA as fallback
                fallback_where = f"(lower(h.STUDENT_ID)='{student_id_decoded}' OR lower(h.STUDENT_FULL_NAME) like '%{student_id_decoded}%')"
                fallback_batch_sql = f"""
                SELECT DISTINCT h.BATCH_ID
                FROM {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK)
                WHERE {fallback_where}
                AND h.INSTITUTION_ID = '{ins_id}'
                AND h.PROJECT_ID = {COLLEGE_PROJECT_ID}
                """
                try:
                    fallback_result = db.execute(text(fallback_batch_sql))
                    fallback_batches = [row[0] for row in fallback_result if row[0]]
                    print(f"[StudentView] Found {len(fallback_batches)} fallback batches from TRANSCRIPT_HDR_DATA for institution {ins_id}")
                    batch_ids.extend(fallback_batches)
                    batch_ids = list(set(batch_ids))  # Remove duplicates
                except Exception as e:
                    print(f"[StudentView] Error querying fallback batches: {e}")
                    import traceback
                    traceback.print_exc()

            # Get batch metadata (OCR_EXTRACTED_DATE, LAST_UPDATED_DATETIME) for all batches
            # Do this AFTER fallback batches are added (matching CI3 line 69: gettabledata)
            if batch_ids:
                # Build safe batch ID list for SQL IN clause
                safe_batch_ids = [b for b in batch_ids if b]
                if safe_batch_ids:
                    batch_metadata_sql = f"""
                    SELECT 
                        h.BATCH_ID,
                        MAX(h.OCR_EXTRACTED_DATE) as OCR_EXTRACTED_DATE,
                        MAX(k.LAST_UPDATED_DATETIME) as LAST_UPDATED_DATETIME
                    FROM {TBL_TRANSCRIPTHDRDATA} as h WITH(NOLOCK)
                    LEFT JOIN {TBL_KICKOUT} as k WITH(NOLOCK) ON k.BATCH_ID = h.BATCH_ID
                    WHERE h.BATCH_ID IN ({','.join([f"'{b}'" for b in safe_batch_ids])})
                    GROUP BY h.BATCH_ID
                    """
                    try:
                        metadata_result = db.execute(text(batch_metadata_sql))
                        for row in metadata_result:
                            batch_id = row[0]
                            if batch_id:
                                # Format dates to MM/DD/YYYY matching CI3 date format (matching CI3 date('m/d/Y', strtotime(...)))
                                ocr_date = ''
                                if row[1]:
                                    if isinstance(row[1], str):
                                        try:
                                            from datetime import datetime
                                            # Handle different date formats
                                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%m/%d/%Y']:
                                                try:
                                                    dt = datetime.strptime(row[1][:19] if len(row[1]) >= 19 else row[1], fmt)
                                                    ocr_date = dt.strftime('%m/%d/%Y')
                                                    break
                                                except:
                                                    continue
                                            if not ocr_date:
                                                ocr_date = row[1]
                                        except:
                                            ocr_date = row[1]
                                    else:
                                        ocr_date = row[1].strftime('%m/%d/%Y') if hasattr(row[1], 'strftime') else str(row[1])
                                
                                last_updated = ''
                                if row[2]:
                                    if isinstance(row[2], str):
                                        try:
                                            from datetime import datetime
                                            # Handle different date formats
                                            date_str = row[2][:19] if len(row[2]) >= 19 else row[2]
                                            for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%m/%d/%Y']:
                                                try:
                                                    dt = datetime.strptime(date_str, fmt)
                                                    last_updated = dt.strftime('%m/%d/%Y')
                                                    break
                                                except:
                                                    continue
                                            if not last_updated:
                                                last_updated = date_str
                                        except:
                                            last_updated = row[2][:10] if len(row[2]) >= 10 else row[2]
                                    else:
                                        last_updated = row[2].strftime('%m/%d/%Y') if hasattr(row[2], 'strftime') else str(row[2])
                                
                                batch_metadata.setdefault(ins_id, {})[batch_id] = {
                                    'OCR_EXTRACTED_DATE': ocr_date,
                                    'LAST_UPDATED_DATETIME': last_updated
                                }
                    except Exception as e:
                        print(f"[StudentView] Error querying batch metadata for institution {ins_id}: {e}")
                        import traceback
                        traceback.print_exc()
            
            # Process each batch and check status counts (matching CI3 lines 63-96)
            for batch_id in batch_ids:
                if not batch_id:
                    continue

                # Prepare postData for getreportsdata (matching CI3 lines 64-66)
                # CI3 uses: fieldType = 'COLLEGE_ID', fieldName = INSTITUTION_ID, BATCH_ID = batch_id (line 64-67)
                # Note: CI3 uses $postData['search']['value'] = $student_id (line 70, 82)
                post_data = {
                    'fieldType': 'COLLEGE_ID',  # CI3 uses COLLEGE_ID fieldType (line 64-65), not BATCH_ID
                    'fieldName': ins_id,  # CI3 uses INSTITUTION_ID as fieldName (line 65)
                    'BATCH_ID': batch_id,  # CI3 passes BATCH_ID as separate field (line 66)
                    'STUDENT_ID': student_id,  # Also set STUDENT_ID directly for model filtering
                    'search': {'value': student_id},  # CI3 line 70, 82
                    'draw': 1,
                    'start': 0,
                    'length': 1,
                    'order': [{'column': 0, 'dir': 'asc'}],
                    'columns': [{'data': 'LAST_UPDATED_DATETIME'}]
                }

                # Check transcript statuses using TranscriptReportsModel (matching CI3 lines 67-78)
                # CI3 passes: fieldType='COLLEGE_ID', fieldName=INSTITUTION_ID, BATCH_ID=batch_id, search.value=student_id
                status_flags = ['Failed', 'Processed', 'Rerun', 'Articulation-Kickouts']
                for status_flag in status_flags:
                    post_data['Search_Field'] = status_flag
                    try:
                        # Debug: log the post_data being sent
                        print(f"[StudentView] Checking transcript {status_flag} for batch {batch_id}, institution {ins_id}, student {student_id}")
                        print(f"[StudentView] Post data: fieldType={post_data.get('fieldType')}, fieldName={post_data.get('fieldName')}, BATCH_ID={post_data.get('BATCH_ID')}, STUDENT_ID={post_data.get('STUDENT_ID')}, Search_Field={post_data.get('Search_Field')}")
                        
                        exp_data = TranscriptReportsModel.get_reports_data(
                            db=db,
                            request_data=post_data,
                            has_update_permission=False
                        )
                        # Use recordsFiltered (filtered count) or recordsTotal as fallback, matching CI3's iTotalRecords
                        count = exp_data.get('recordsFiltered', exp_data.get('recordsTotal', exp_data.get('iTotalRecords', 0)))
                        print(f"[StudentView] Transcript {status_flag} count for batch {batch_id}: {count}")
                        # Always set the count (even if 0) to ensure the field exists in the structure
                        response_data.setdefault(ins_id, {}).setdefault(batch_id, {})[status_flag] = count
                        if count > 0:
                            status_flags_list.append(status_flag)
                            if batch_id not in batch_inside:
                                batch_inside.append(batch_id)
                    except Exception as e:
                        print(f"[StudentView] Error getting transcript count for {status_flag}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

                # Check articulation statuses using ArticulationReportsModel (matching CI3 lines 79-91)
                art_status_flags = ['Failed', 'Processed', 'Rerun']
                for status_flag in art_status_flags:
                    post_data['Search_Field'] = status_flag
                    try:
                        exp_data = ArticulationReportsModel.get_reports_data(
                            db=db,
                            request_data=post_data,
                            has_update_permission=False
                        )
                        # Use recordsFiltered (filtered count) or recordsTotal as fallback, matching CI3's iTotalRecords
                        count = exp_data.get('recordsFiltered', exp_data.get('recordsTotal', exp_data.get('iTotalRecords', 0)))
                        print(f"[StudentView] Articulation {status_flag} count for batch {batch_id}: {count}")
                        # Always set the count (even if 0) to ensure the field exists in the structure
                        key = f'articulation_{status_flag}'
                        response_data.setdefault(ins_id, {}).setdefault(batch_id, {})[key] = count
                        if count > 0:
                            status_flags_list.append(key)
                            if batch_id not in batch_inside:
                                batch_inside.append(batch_id)
                    except Exception as e:
                        print(f"[StudentView] Error getting articulation count for {status_flag}: {e}")
                        import traceback
                        traceback.print_exc()
                        continue

            # Add batches to batch_details - include ALL batches that were found, even if they have no status counts
            # This matches CI3 behavior where batches with metadata are shown even if menu_list is empty
            # Use batch_inside (batches with counts) if available, otherwise use all batch_ids
            if batch_inside:
                batch_details[ins_id] = list(set(batch_inside))
            elif batch_ids:
                # If no status counts but batches exist, still include them (batches with metadata should appear)
                batch_details[ins_id] = list(set(batch_ids))
                print(f"[StudentView] No status counts found, but including {len(batch_ids)} batches with metadata for institution {ins_id}")
            else:
                batch_details[ins_id] = []
            
            total_transcripts = total_transcripts + len(batch_details[ins_id])
            
            # Initialize menu_list structure for all batches in batch_details
            # This ensures menu_list[institution_id][batch_id] exists with ALL fields (even if 0)
            # This matches CI3 behavior where the view expects the complete structure to exist
            # Default structure with all possible status fields
            default_menu_fields = {
                'Failed': 0,
                'Processed': 0,
                'Rerun': 0,
                'Articulation-Kickouts': 0,
                'articulation_Failed': 0,
                'articulation_Processed': 0,
                'articulation_Rerun': 0
            }
            
            if ins_id in batch_details and batch_details[ins_id]:
                for batch_id_item in batch_details[ins_id]:
                    if batch_id_item:
                        # Initialize the structure if it doesn't exist
                        if ins_id not in response_data:
                            response_data[ins_id] = {}
                        if batch_id_item not in response_data[ins_id]:
                            # Create new structure with all default fields
                            response_data[ins_id][batch_id_item] = default_menu_fields.copy()
                        else:
                            # Merge existing counts with defaults to ensure all fields are present
                            existing_counts = response_data[ins_id][batch_id_item]
                            merged = default_menu_fields.copy()
                            merged.update(existing_counts)  # Keep existing counts, fill in missing fields
                            response_data[ins_id][batch_id_item] = merged

        # Get student info (matching CI3 lines 100-124)
        if student_id:
            where = f"(lower(s.STUDENT_ID)='{student_id_decoded}' OR lower(s.STUDENT_FULL_NAME) like '%{student_id_decoded}%')"
            
            student_sql = f"""
            SELECT s.STUDENT_ID, MAX(s.STUDENT_FULL_NAME) as STUDENT_FULL_NAME
            FROM {TBL_TRANSCRIPTHDRDATA} as s WITH(NOLOCK)
            WHERE {where}
            GROUP BY s.STUDENT_ID
            """
            
            try:
                student_result = db.execute(text(student_sql))
                student_row = student_result.fetchone()
                
                if student_row and student_row[0]:
                    admission_decision = ''
                    try:
                        # Match CI3: SELECT TOP 1 APPLICATION_STATUS_DESC FROM BANNER_APPLICANT_DATA
                        # WHERE STUDENT_ID = ? ORDER BY SARADAP_APST_DATE DESC
                        banner_sql = f"""
                        SELECT TOP 1 APPLICATION_STATUS_DESC
                        FROM {TBL_BANNER_APPLICANT_DATA} AD WITH(NOLOCK)
                        WHERE STUDENT_ID = :sid
                        ORDER BY AD.SARADAP_APST_DATE DESC
                        """
                        banner_result = db.execute(text(banner_sql), {"sid": student_row[0]})
                        banner_row = banner_result.fetchone()
                        if banner_row and banner_row[0]:
                            admission_decision = banner_row[0] or ''
                    except Exception as e:
                        print(f"[StudentView] Error querying BANNER_APPLICANT_DATA: {e}")
                    student_info = {
                        'STUDENT_ID': student_row[0] or '',
                        'STUDENT_FULL_NAME': student_row[1] or '',
                        'ADMISSION_DECISION': admission_decision,
                    }
                    print(f"[StudentView] Found student info: {student_info}")
            except Exception as e:
                print(f"[StudentView] Error querying student info: {e}")
                import traceback
                traceback.print_exc()

    result = {
        'student_info': student_info or {},
        'institution_name': institution_name,
        'status_flags_list': list(set(status_flags_list)),
        'total_transcripts': total_transcripts,
        'menu_list': response_data,
        'batch_details': batch_details,
        'batch_metadata': batch_metadata,
        'institution_id': institution_id or '',
        'student_id': student_id or '',
        'batch_id': batch_id or '',
        'type': report_type or '',
    }
    
    print(f"[StudentView] Returning result with {len(institution_name)} institutions, {total_transcripts} total transcripts")
    print(f"[StudentView] Response data keys: {list(response_data.keys())}")
    
    return result


@router.get("/getstudentslist", response_model=List[StudentListResponse])
async def getstudentslist(
    q: Optional[str] = Query(None, alias="q"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get students list for dropdown.
    Matches: CI3 Studentview::getstudentslist() (application/controllers/Studentview.php)
    """
    if q:
        where_clause = f"(LOWER(STUDENT_FULL_NAME) LIKE '%{check_special_name(q.lower())}%' OR LOWER(STUDENT_ID) LIKE '%{check_special_name(q.lower())}%')"
    else:
        where_clause = "1=1"

    sql = f"""
    SELECT STUDENT_ID, STUDENT_FULL_NAME
    FROM {TBL_TRANSCRIPTHDRDATA}
    WHERE {where_clause}
    AND PROJECT_ID = {COLLEGE_PROJECT_ID}
    GROUP BY STUDENT_ID, STUDENT_FULL_NAME
    ORDER BY STUDENT_FULL_NAME ASC
    """
    
    result = db.execute(text(sql))
    students = [{"STUDENT_ID": row[0] or "", "STUDENT_FULL_NAME": row[1] or ""} for row in result]
    
    return students


@router.post("/viewpageload")
async def viewpageload(
    request: ViewPageLoadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Load transcript reports view (SPA: frontend embeds TranscriptReports; no HTML returned).
    Matches: CI3 Studentview::viewpageload() (application/controllers/Studentview.php)
    """
    # For now, return a redirect to transcriptreports with filters
    # In a full implementation, you'd render the view server-side or return the data
    return {
        "success": 1,
        "message": "View loaded",
        "redirect": f"/college/transcriptreports?student_id={request.student_id}&batch_id={request.batch_id}&institution_id={request.institution_id}&type={request.type}"
    }


@router.post("/articulationviewpageload")
async def articulationviewpageload(
    request: ViewPageLoadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Load articulation reports view (SPA: frontend embeds ArticulationReports; no HTML returned).
    Matches: CI3 Studentview::articulationviewpageload() (application/controllers/Studentview.php)
    """
    return {
        "success": 1,
        "message": "View loaded",
        "redirect": f"/college/articulationreports?student_id={request.student_id}&batch_id={request.batch_id}&institution_id={request.institution_id}&type={request.type}"
    }
