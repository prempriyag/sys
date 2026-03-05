"""
Bulk Textract Extract: Process assembly PDFs one by one via AWS Textract.
For each PDF: extract → insert to voter_data → move to extracted/state/year/district/constituency.
Folder structure matches ECI download: state/year/district/constituency/.
"""
import logging
import os
import re
import shutil
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def _safe_folder_name(s: Optional[str]) -> str:
    """Sanitize for folder path."""
    if not s or not str(s).strip():
        return "unknown"
    s = str(s).strip().replace("\\", "_").replace("/", "_").replace(":", "_")
    for c in '*?"<>|':
        s = s.replace(c, "_")
    s = re.sub(r"\s+", "_", s).strip("_")
    return s or "unknown"


def _get_extracted_base() -> str:
    """Resolve extracted folder path (same as bulk_electoral)."""
    extracted_base = os.environ.get("EXTRACTED_FOLDER", "").strip()
    if not extracted_base:
        backend_dir = Path(__file__).resolve().parent.parent
        extracted_base = str(backend_dir / "extracted")
    return extracted_base


def _move_pdf_to_extracted(
    pdf_path: str,
    extracted_base: Path,
    state: Optional[str],
    year: Optional[str],
    district: Optional[str],
    constituency_name: Optional[str],
) -> bool:
    """Move PDF to extracted/state/year/district/constituency_name/filename."""
    try:
        src = Path(pdf_path)
        if not src.exists():
            return False
        constituency_folder = _safe_folder_name(constituency_name) if (constituency_name or "").strip() else _safe_folder_name(src.stem)
        folder = (
            extracted_base
            / _safe_folder_name(state)
            / _safe_folder_name(year)
            / _safe_folder_name(district)
            / constituency_folder
        )
        folder.mkdir(parents=True, exist_ok=True)
        dest = folder / src.name
        if dest.resolve() == src.resolve():
            return True
        shutil.move(str(src), str(dest))
        logger.info("[Textract Bulk] Moved %s -> %s", src.name, dest)
        return True
    except Exception as e:
        logger.warning("Could not move PDF %s to extracted: %s", pdf_path, e)
        return False


def _process_one_pdf_textract(
    pdf_path: str,
    default_constituency: Optional[str] = None,
    default_booth: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Extract one PDF via AWS Textract. Returns (records, metadata).
    """
    from services.textract_extractor import extract_from_pdf_textract

    path = Path(pdf_path)
    if not path.exists():
        return [], {}
    source_name = path.name
    result = extract_from_pdf_textract(
        path,
        default_constituency_name=default_constituency,
        default_booth_number=default_booth,
    )
    records = result.get("records") or []
    meta = result.get("metadata") or {}
    for r in records:
        r["source_pdf"] = source_name
        if meta.get("year") and not (r.get("year") or "").strip():
            r["year"] = str(meta.get("year", "")).strip()
    return records, meta


def _infer_meta_from_folder_path(folder_path: str) -> Dict[str, str]:
    """Infer state/year/district/constituency from path .../state/year/district/constituency."""
    try:
        parts = [p for p in Path(folder_path).resolve().parts if p and p not in ("/", "\\")]
    except Exception:
        parts = [p for p in Path(folder_path).parts if p and p not in ("/", "\\")]
    if len(parts) >= 4:
        return {"state": parts[-4], "year": parts[-3], "district": parts[-2], "constituency_name": parts[-1]}
    if len(parts) == 3:
        return {"state": parts[-3], "year": parts[-2], "district": parts[-1], "constituency_name": ""}
    return {}


def run_bulk_textract(
    pdf_paths: List[str],
    db_session_factory,
    extracted_base: Optional[str] = None,
    state: Optional[str] = None,
    year: Optional[str] = None,
    district: Optional[str] = None,
    constituency_name: Optional[str] = None,
    folder_path: Optional[str] = None,
    progress_callback: Optional[Callable[[int, int, str, int], None]] = None,
) -> Dict[str, Any]:
    """
    Process PDFs one by one: extract via Textract → insert to voter_data → move to extracted.
    Extracted folder structure: state/year/district/constituency/filename (matches download).
    """
    from services.bulk_electoral_roll_engine import insert_records_one_by_one

    base = Path(extracted_base.strip()).resolve() if (extracted_base or "").strip() else Path(_get_extracted_base()).resolve()

    # Infer meta from folder path if not provided
    path_meta = _infer_meta_from_folder_path(folder_path) if folder_path else {}
    eff_state = (state or "").strip() or path_meta.get("state") or "unknown_state"
    eff_year = (year or "").strip() or path_meta.get("year") or "unknown_year"
    eff_district = (district or "").strip() or path_meta.get("district") or "unknown_district"
    eff_constituency = (constituency_name or "").strip() or path_meta.get("constituency_name") or ""

    total_inserted = 0
    total_duplicates = 0
    moved_count = 0
    total_found = 0

    for current_index, pdf_path in enumerate(pdf_paths, start=1):
        try:
            pdf_name = Path(pdf_path).name
            if progress_callback:
                progress_callback(current_index - 1, len(pdf_paths), pdf_name, total_inserted)

            records, meta = _process_one_pdf_textract(
                pdf_path,
                default_constituency=eff_constituency or None,
                default_booth=None,
            )
            total_found += len(records)

            per_pdf_constituency = (eff_constituency or meta.get("constituency_name") or "").strip() or Path(pdf_path).stem
            meta_year = (meta.get("year") or eff_year or "").strip()

            for r in records:
                if not (r.get("constituency_name") or "").strip():
                    r["constituency_name"] = per_pdf_constituency
                if meta_year and not (r.get("year") or "").strip():
                    r["year"] = meta_year
                elif eff_year and eff_year != "unknown_year":
                    r["year"] = eff_year

            inserted, dup = insert_records_one_by_one(db_session_factory, records)
            total_inserted += inserted
            total_duplicates += dup

            if _move_pdf_to_extracted(
                pdf_path, base, eff_state, eff_year, eff_district, per_pdf_constituency
            ):
                moved_count += 1

            if progress_callback:
                progress_callback(current_index, len(pdf_paths), pdf_name, total_inserted)

        except Exception as e:
            logger.exception("[Textract Bulk] Failed for %s: %s", pdf_path, e)
            if progress_callback:
                progress_callback(current_index, len(pdf_paths), Path(pdf_path).name, total_inserted)

    return {
        "total_found": total_found,
        "inserted": total_inserted,
        "duplicates_skipped": total_duplicates,
        "pdf_count": len(pdf_paths),
        "moved_count": moved_count,
        "extracted_folder": str(base),
    }


def list_pdfs_in_folder(folder_path: str) -> List[str]:
    """List all PDF files in folder (and subfolders for assembly structure)."""
    folder = Path(folder_path).resolve()
    if not folder.is_dir():
        return []
    pdfs: List[str] = []
    for f in folder.rglob("*.pdf"):
        if f.is_file():
            pdfs.append(str(f))
    return sorted(pdfs)


def discover_pdf_folder_paths() -> List[str]:
    """
    Discover all server folders that contain PDFs. Used for bulk upload dropdown.
    Scans roots from BULK_SCAN_ROOTS env (comma-separated) or default: download, bulk_rolls.
    Returns paths relative to backend dir (e.g. download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam).
    """
    backend_dir = Path(__file__).resolve().parent.parent
    roots_env = os.environ.get("BULK_SCAN_ROOTS", "download,bulk_rolls").strip()
    roots = [r.strip() for r in roots_env.split(",") if r.strip()]
    if not roots:
        roots = ["download", "bulk_rolls"]

    seen: set[str] = set()
    result: List[str] = []
    for root_name in roots:
        root = (backend_dir / root_name).resolve()
        if not root.is_dir():
            continue
        for dirpath, _, filenames in os.walk(root):
            if any(name.lower().endswith(".pdf") for name in filenames):
                dir_path = Path(dirpath)
                try:
                    rel = str(dir_path.relative_to(backend_dir)).replace("\\", "/")
                except ValueError:
                    rel = str(dir_path)
                if rel and rel not in seen:
                    seen.add(rel)
                    result.append(rel)
    return sorted(result)
