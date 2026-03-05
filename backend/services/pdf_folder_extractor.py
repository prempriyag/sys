"""
Production folder extractor: read one PDF at a time, extract ALL pages,
insert with pdf_name + box_id (unique per PDF), commit, then move PDF to extracted/.
Folder structure: extracted/state/year/district/constituency_name/
"""
import logging
import shutil
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _safe_folder(s: Optional[str]) -> str:
    if not s or not str(s).strip():
        return "unknown"
    s = str(s).strip().replace("\\", "_").replace("/", "_").replace(":", "_")
    for c in '*?"<>|':
        s = s.replace(c, "_")
    s = __import__("re").sub(r"\s+", "_", s).strip("_")
    return s or "unknown"


def move_pdf(
    pdf_path: Path,
    extracted_base: Path,
    state: Optional[str],
    year: Optional[str],
    district: Optional[str],
    constituency: Optional[str],
) -> bool:
    """Move PDF to extracted_base/state/year/district/constituency/filename. Creates dirs."""
    try:
        constituency_folder = _safe_folder(constituency) if (constituency or "").strip() else _safe_folder(pdf_path.stem)
        target_folder = (
            extracted_base
            / _safe_folder(state)
            / _safe_folder(year)
            / _safe_folder(district)
            / constituency_folder
        )
        target_folder.mkdir(parents=True, exist_ok=True)
        dest = target_folder / pdf_path.name
        if dest.resolve() == pdf_path.resolve():
            return True
        shutil.move(str(pdf_path), str(dest))
        logger.info("Moved %s -> %s", pdf_path.name, dest)
        return True
    except Exception as e:
        logger.warning("Could not move PDF %s: %s", pdf_path, e)
        return False


def process_folder(
    folder_path: str,
    db: Session,
    extracted_base: str,
    constituency_name: Optional[str] = None,
    state: Optional[str] = None,
    year: Optional[str] = None,
    district: Optional[str] = None,
    use_ocr: bool = False,
    progress_callback: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    For each PDF in folder: extract ALL pages -> insert with box_id -> commit -> move PDF.
    Returns total_inserted, pdf_processed, errors.
    """
    from sqlalchemy import inspect
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models.sir.bulk_voter_import import BulkVoterImport

    try:
        from services.electoral_roll_pdf_extractor import extract_from_pdf
    except ImportError:
        from electoral_roll_pdf_extractor import extract_from_pdf

    folder = Path(folder_path)
    if not folder.is_dir():
        return {"total_inserted": 0, "pdf_processed": 0, "error": "Not a directory"}

    pdf_files = sorted(folder.glob("*.pdf"))
    if not pdf_files:
        return {"total_inserted": 0, "pdf_processed": 0, "message": "No PDF files in folder"}

    extracted_base_path = Path(extracted_base).resolve()
    total_inserted = 0
    total_pdfs = len(pdf_files)
    errors: List[str] = []
    batch_size = 100
    inspector = inspect(db.bind)
    table_cols = {c.get("name") for c in inspector.get_columns("voter_data")}
    unique_sets = {frozenset(u.get("column_names") or []) for u in inspector.get_unique_constraints("voter_data")}
    conflict_cols = None
    if {"pdf_name", "box_id"}.issubset(table_cols) and frozenset(("pdf_name", "box_id")) in unique_sets:
        conflict_cols = ["pdf_name", "box_id"]
    elif "epic_number" in table_cols and frozenset(("epic_number",)) in unique_sets:
        conflict_cols = ["epic_number"]

    for current_index, pdf_path in enumerate(pdf_files, start=1):
        pdf_name = pdf_path.name
        try:
            if progress_callback:
                progress_callback(current_index - 1, total_pdfs, pdf_name, total_inserted)

            result = extract_from_pdf(
                pdf_path,
                default_constituency_name=constituency_name or "",
                use_ocr=use_ocr,
            )
            records: List[Dict[str, Any]] = result.get("records") or []

            if not records:
                logger.info("No records from %s", pdf_name)
                if progress_callback:
                    progress_callback(current_index, total_pdfs, pdf_name, total_inserted)
                continue

            box_counter = 1
            inserted_this_pdf = 0
            pending_rows: List[Dict[str, Any]] = []

            def _commit_pending(sleep_after: bool = False) -> int:
                nonlocal total_inserted, inserted_this_pdf, pending_rows
                if not pending_rows:
                    return 0
                batch_len = len(pending_rows)
                stmt = pg_insert(BulkVoterImport).values(pending_rows)
                if conflict_cols:
                    stmt = stmt.on_conflict_do_nothing(index_elements=conflict_cols)
                res = db.execute(stmt)
                db.commit()
                count = res.rowcount if res.rowcount is not None and res.rowcount >= 0 else len(pending_rows)
                total_inserted += count
                inserted_this_pdf += count
                pending_rows = []
                if sleep_after and batch_len >= 100:
                    time.sleep(2)
                return count

            for rec in records:
                epic = (rec.get("epic_number") or "").strip()
                name = (rec.get("name") or "").strip()[:255]
                relative_name = (rec.get("relative_name") or "").strip()[:255]
                relation_type = (rec.get("relation_type") or rec.get("relation") or "").strip()[:20]
                age = rec.get("age")
                if age is not None and not isinstance(age, int):
                    try:
                        age = int(age)
                    except (TypeError, ValueError):
                        age = None
                gender = (rec.get("gender") or "").strip()[:10]
                conf = rec.get("confidence_score") or rec.get("confidence")
                if conf is not None:
                    try:
                        conf = float(conf)
                    except (TypeError, ValueError):
                        conf = 1.0
                else:
                    conf = 1.0

                voter = {
                    "page_number": rec.get("page_number"),
                    "epic_number": epic or None,
                    "name": name or None,
                    "relative_name": relative_name or None,
                    "age": age,
                    "gender": gender or None,
                    "house_no": (rec.get("house_no") or "").strip()[:200] or None,
                    "address": (rec.get("address") or "").strip() or None,
                    "constituency_name": (constituency_name or rec.get("constituency_name") or "").strip()[:200] or None,
                    "year": (year or "").strip()[:20] or None,
                    "booth_number": (rec.get("booth_number") or "").strip()[:50] or None,
                    "source_pdf": pdf_name,
                    "confidence": conf,
                }
                if "pdf_name" in table_cols:
                    voter["pdf_name"] = pdf_name
                if "box_id" in table_cols:
                    voter["box_id"] = box_counter
                if "relation_type" in table_cols:
                    voter["relation_type"] = relation_type or None
                if "confidence_score" in table_cols:
                    voter["confidence_score"] = conf
                voter = {k: v for k, v in voter.items() if k in table_cols}
                pending_rows.append(voter)
                if len(pending_rows) >= batch_size:
                    try:
                        _commit_pending(sleep_after=True)
                    except Exception as commit_err:
                        db.rollback()
                        logger.exception("DB INSERT FAILED for %s around box_id=%s: %s", pdf_name, box_counter, commit_err)
                        raise
                box_counter += 1

            if pending_rows:
                try:
                    _commit_pending(sleep_after=False)
                except Exception as commit_err:
                    db.rollback()
                    logger.exception("DB INSERT FAILED for %s (final batch): %s", pdf_name, commit_err)
                    raise

            if inserted_this_pdf:
                logger.info("Committed %d boxes from %s to voter_data (batch size=%d).", inserted_this_pdf, pdf_name, batch_size)

            if move_pdf(
                pdf_path,
                extracted_base_path,
                state,
                year,
                district,
                constituency_name,
            ):
                pass  # moved_count if needed

            if progress_callback:
                progress_callback(current_index, total_pdfs, pdf_name, total_inserted)

        except Exception as e:
            db.rollback()
            logger.exception("Failed for %s (data not inserted): %s", pdf_name, e)
            errors.append(f"{pdf_name}: {e}")
            if progress_callback:
                progress_callback(current_index, total_pdfs, pdf_name, total_inserted)

    return {
        "total_inserted": total_inserted,
        "pdf_processed": total_pdfs,
        "total_found": total_inserted,
        "inserted": total_inserted,
        "duplicates_skipped": 0,
        "invalid_epic_count": 0,
        "invalid_epics": [],
        "pdf_count": total_pdfs,
        "moved_count": total_pdfs - len(errors),
        "errors": errors,
    }
