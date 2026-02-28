"""
Folder watcher for automated file processing.
Monitors EXTRACT_OCR_FOLDER; on new PDF, triggers process_file_and_store.
"""
import logging
import os
import threading
import time
from pathlib import Path
from typing import Callable, Optional, Set

from database.connection import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_watcher_thread: Optional[threading.Thread] = None
_watcher_stop = threading.Event()
_processed_files: Set[str] = set()


def _get_watch_folder() -> Optional[Path]:
    folder = (settings.EXTRACT_OCR_FOLDER or os.getenv("EXTRACT_OCR_FOLDER", "")).strip()
    if not folder:
        return None
    p = Path(folder)
    if not p.exists():
        try:
            p.mkdir(parents=True, exist_ok=True)
            logger.info("Created watch folder: %s", p)
        except OSError as e:
            logger.warning("Could not create watch folder %s: %s", folder, e)
            return None
    return p


def _get_archive_folder() -> Path:
    folder = (settings.EXTRACT_ARCHIVE_FOLDER or os.getenv("EXTRACT_ARCHIVE_FOLDER", "")).strip()
    if folder:
        return Path(folder)
    watch = _get_watch_folder()
    if watch:
        return watch / "archived"
    return Path(".") / "extract_archived"


def _process_new_files() -> None:
    """Scan watch folder for new PDFs and process them."""
    watch_folder = _get_watch_folder()
    if not watch_folder:
        return
    archive_folder = _get_archive_folder()
    try:
        from services.extract_batch_service import process_file_and_store
    except ImportError:
        from extract_batch_service import process_file_and_store

    pdf_files = list(watch_folder.glob("*.pdf"))
    for pdf_path in sorted(pdf_files):
        key = str(pdf_path.resolve())
        if key in _processed_files:
            continue
        _processed_files.add(key)
        try:
            db = SessionLocal()
            try:
                result = process_file_and_store(pdf_path, archive_folder, db, use_ocr=True)
                if result.get("status") == "success":
                    logger.info("Processed %s -> batch_id=%s, records=%d", pdf_path.name, result.get("batch_id"), result.get("records_count", 0))
                    # Remove source from watch folder (file already archived by service)
                    try:
                        if pdf_path.exists():
                            pdf_path.unlink()
                    except OSError as del_err:
                        logger.warning("Could not remove processed file %s: %s", pdf_path.name, del_err)
                else:
                    logger.warning("Processing failed for %s: %s", pdf_path.name, result.get("error"))
                    _processed_files.discard(key)  # Allow retry
            finally:
                db.close()
        except Exception as e:
            logger.exception("Error processing %s: %s", pdf_path.name, e)
            _processed_files.discard(key)


def _poll_loop() -> None:
    """Polling loop (runs when watchdog not available)."""
    while not _watcher_stop.wait(timeout=5.0):
        try:
            _process_new_files()
        except Exception as e:
            logger.exception("Folder watcher poll error: %s", e)


def start_folder_watcher() -> bool:
    """
    Start the folder watcher (polling or watchdog).
    Returns True if started, False if EXTRACT_OCR_FOLDER not set.
    """
    global _watcher_thread
    if _get_watch_folder() is None:
        logger.info("EXTRACT_OCR_FOLDER not set; folder watcher disabled")
        return False
    if _watcher_thread and _watcher_thread.is_alive():
        return True
    _watcher_stop.clear()
    _watcher_thread = threading.Thread(target=_poll_loop, daemon=True)
    _watcher_thread.start()
    logger.info("Folder watcher started (EXTRACT_OCR_FOLDER=%s)", _get_watch_folder())
    return True


def stop_folder_watcher() -> None:
    """Stop the folder watcher."""
    global _watcher_thread
    _watcher_stop.set()
    if _watcher_thread:
        _watcher_thread.join(timeout=10.0)
        _watcher_thread = None
    logger.info("Folder watcher stopped")
