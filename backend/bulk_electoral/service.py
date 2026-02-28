"""
Bulk Electoral Roll: PDF extraction + insert to voter_data.
Wraps pdf_folder_extractor (folder flow) and bulk_electoral_roll_engine (file flow).
"""
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_extracted_base() -> str:
    """Resolve extracted folder path for moved PDFs."""
    extracted_base = os.environ.get("EXTRACTED_FOLDER", "").strip()
    if not extracted_base:
        backend_dir = Path(__file__).resolve().parent.parent
        extracted_base = str(backend_dir / "extracted")
    return extracted_base


def process_folder(
    folder_path: str,
    db: Session,
    extracted_base: Optional[str] = None,
    constituency_name: Optional[str] = None,
    state: Optional[str] = None,
    year: Optional[str] = None,
    district: Optional[str] = None,
    use_ocr: bool = True,
    progress_callback: Optional[Callable[[int, int, str, int], None]] = None,
) -> Dict[str, Any]:
    """
    Production folder flow: extract each PDF, insert to voter_data, move to extracted/.
    Uses services.pdf_folder_extractor.process_folder.
    """
    from services.pdf_folder_extractor import process_folder as _process_folder

    base = extracted_base or get_extracted_base()
    return _process_folder(
        folder_path,
        db,
        base,
        constituency_name=constituency_name,
        state=state,
        year=year,
        district=district,
        use_ocr=use_ocr,
        progress_callback=progress_callback,
    )


def process_files(
    pdf_paths: List[str],
    SessionLocal,
    extracted_base: Optional[str] = None,
    constituency_name: Optional[str] = None,
    state: Optional[str] = None,
    year: Optional[str] = None,
    district: Optional[str] = None,
    max_workers: int = 1,
    batch_size: int = 500,
    progress_callback: Optional[Callable[[int, int, str, int], None]] = None,
) -> Dict[str, Any]:
    """
    File upload flow: run bulk_electoral_roll_engine on temp PDFs.
    """
    from services.bulk_electoral_roll_engine import run_bulk

    base = extracted_base or get_extracted_base()
    return run_bulk(
        pdf_paths,
        SessionLocal,
        max_workers=max_workers,
        batch_size=batch_size,
        constituency_name=constituency_name,
        year=year,
        extracted_base=base,
        state=state,
        district=district,
        progress_callback=progress_callback,
    )
