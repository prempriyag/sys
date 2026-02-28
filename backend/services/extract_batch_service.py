"""
Automated File Processing & Data Extraction
- Generates 5-digit Batch ID per file
- Populates extract_downloads, extract_headers, extract_lines
- Archives original file for reprocessing
"""
import logging
import os
import random
import string
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def generate_batch_id(db: Session) -> str:
    """Generate unique 5-digit batch ID."""
    from models.extract_batch import ExtractDownload
    for _ in range(100):
        bid = "".join(random.choices(string.digits, k=5))
        if not db.query(ExtractDownload).filter(ExtractDownload.batch_id == bid).first():
            return bid
    raise RuntimeError("Could not generate unique 5-digit batch ID")


def get_file_created_datetime(file_path: Path) -> Optional[datetime]:
    """Get file creation timestamp."""
    try:
        stat = file_path.stat()
        t = stat.st_ctime
        return datetime.fromtimestamp(t)
    except OSError:
        return None


def process_file_and_store(
    pdf_path: Path,
    archive_base: Path,
    db: Session,
    use_ocr: bool = True,
) -> Dict[str, Any]:
    """
    Process one PDF: extract, store in DB (downloads, headers, lines), archive file.
    Returns { batch_id, status, records_count, error? }.
    """
    from models.extract_batch import ExtractDownload, ExtractHeader, ExtractLine
    from services.electoral_roll_pdf_extractor import extract_from_pdf

    batch_id = generate_batch_id(db)
    file_name = pdf_path.name
    file_created = get_file_created_datetime(pdf_path)

    try:
        result = extract_from_pdf(
            pdf_path,
            use_ocr=use_ocr,
        )
        records: List[Dict[str, Any]] = result.get("records") or []
        metadata: Dict[str, Any] = result.get("metadata") or {}

        # Total pages
        total_pages = metadata.get("pages_processed") or len(records and set(r.get("page_number") for r in records if r.get("page_number"))) or 1

        # Archive file
        stored_path = None
        if archive_base:
            archive_base.mkdir(parents=True, exist_ok=True)
            dest = archive_base / f"{batch_id}_{file_name}"
            try:
                import shutil
                shutil.copy2(str(pdf_path), str(dest))
                stored_path = str(dest)
            except Exception as e:
                logger.warning("Could not archive file %s: %s", file_name, e)

        # Insert extract_downloads
        down = ExtractDownload(
            batch_id=batch_id,
            original_file_name=file_name,
            file_created_datetime=file_created,
            total_pages=total_pages,
            stored_path=stored_path,
        )
        db.add(down)
        db.flush()

        # Insert extract_headers from metadata
        header_keys = (
            "constituency_name", "booth_number", "part_name",
            "revision_year", "qualifying_date", "type_of_revision",
            "date_of_publication", "polling_station", "ward_no", "district",
            "main_town_or_village", "roll_identification", "parliamentary_constituency",
            "starting_serial_no", "ending_serial_no", "net_electors_total",
        )
        for key in header_keys:
            val = metadata.get(key)
            if val is not None and str(val).strip():
                h = ExtractHeader(batch_id=batch_id, header_key=key, header_value=str(val).strip()[:2000])
                db.add(h)

        # Insert extract_lines from records
        for i, rec in enumerate(records, start=1):
            age = rec.get("age")
            if age is not None and not isinstance(age, int):
                try:
                    age = int(age)
                except (TypeError, ValueError):
                    age = None
            conf = rec.get("confidence_score")
            if conf is not None:
                try:
                    conf = float(conf)
                except (TypeError, ValueError):
                    conf = None
            line = ExtractLine(
                batch_id=batch_id,
                line_number=i,
                page_number=rec.get("page_number"),
                epic_number=(rec.get("epic_number") or "").strip()[:20] or None,
                name=(rec.get("name") or "").strip()[:255] or None,
                relative_name=(rec.get("relative_name") or "").strip()[:255] or None,
                age=age,
                gender=(rec.get("gender") or "").strip()[:10] or None,
                house_no=(rec.get("house_no") or "").strip()[:200] or None,
                address=(rec.get("address") or "").strip() or None,
                booth_number=(rec.get("booth_number") or "").strip()[:50] or None,
                constituency_name=(rec.get("constituency_name") or "").strip()[:200] or None,
                confidence_score=conf,
            )
            db.add(line)

        db.commit()
        return {
            "batch_id": batch_id,
            "status": "success",
            "records_count": len(records),
            "total_pages": total_pages,
        }
    except Exception as e:
        db.rollback()
        logger.exception("Process file %s failed: %s", file_name, e)
        return {
            "batch_id": batch_id,
            "status": "error",
            "records_count": 0,
            "error": str(e),
        }
