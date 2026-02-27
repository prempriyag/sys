"""
Bulk-run electoral roll extraction for many folders (production batch runner).

Discovers all subfolders that contain PDFs, processes each folder with
services.pdf_folder_extractor.process_folder, and writes retry files for failures.

Usage examples:
  python scripts/run_bulk_roll_folders.py --root "backend/download"
  python scripts/run_bulk_roll_folders.py --root "backend/download/Tamil_Nadu/2026" --max-folders 50
  python scripts/run_bulk_roll_folders.py --root "backend/download" --use-ocr false --dry-run
  python scripts/run_bulk_roll_folders.py --root "backend/download" --resume
"""
import argparse
import csv
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


# Run from backend directory context.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def _parse_bool(v: str) -> bool:
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def _discover_pdf_folders(root: Path) -> List[Path]:
    """Return all directories under root that contain at least one PDF file."""
    folders: List[Path] = []
    for dirpath, _, filenames in os.walk(root):
        if any(name.lower().endswith(".pdf") for name in filenames):
            folders.append(Path(dirpath))
    return sorted(set(folders))


def _infer_meta_from_relative_parts(parts: List[str]) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Infer (state, year, district, constituency) from relative path parts.
    Expected shape: state/year/district/constituency
    """
    if len(parts) >= 4:
        return parts[0], parts[1], parts[2], parts[3]
    if len(parts) == 3:
        return parts[0], parts[1], parts[2], None
    if len(parts) == 2:
        return parts[0], parts[1], None, None
    if len(parts) == 1:
        return parts[0], None, None, None
    return None, None, None, None


def _split_error_item(err: str) -> Tuple[str, str]:
    """
    process_folder error format is usually: "<pdf_name>: <error text>".
    Returns (pdf_name_or_empty, error_text).
    """
    s = (err or "").strip()
    if ":" in s:
        left, right = s.split(":", 1)
        return left.strip(), right.strip()
    return "", s


def _load_checkpoint(path: Path) -> Dict[str, object]:
    if not path.exists():
        return {"completed_folders": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {"completed_folders": []}
        completed = data.get("completed_folders")
        if not isinstance(completed, list):
            data["completed_folders"] = []
        return data
    except Exception:
        return {"completed_folders": []}


def _save_checkpoint(path: Path, checkpoint: Dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(checkpoint, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Bulk process electoral-roll PDF folders and write retry lists.")
    parser.add_argument("--root", required=True, help="Root directory to scan for PDF folders.")
    parser.add_argument(
        "--extracted-base",
        default=None,
        help="Destination extracted base folder. Default: <backend>/extracted",
    )
    parser.add_argument("--state", default=None, help="Optional override for state.")
    parser.add_argument("--year", default=None, help="Optional override for year.")
    parser.add_argument("--district", default=None, help="Optional override for district.")
    parser.add_argument("--constituency", default=None, help="Optional override for constituency.")
    parser.add_argument("--use-ocr", default="true", help="Use OCR flow (true/false). Default: true.")
    parser.add_argument("--max-folders", type=int, default=0, help="Process only first N discovered folders.")
    parser.add_argument("--dry-run", action="store_true", help="Only list folders; do not process.")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint: skip completed folders.")
    parser.add_argument("--reset-checkpoint", action="store_true", help="Delete checkpoint before running.")
    parser.add_argument(
        "--checkpoint-file",
        default=None,
        help="Checkpoint JSON path. Default: <backend>/extracted/run_logs/bulk_run_checkpoint.json",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Output directory for run summary and retry files. Default: <backend>/extracted/run_logs/<timestamp>",
    )
    args = parser.parse_args()

    backend_dir = Path(__file__).resolve().parent.parent
    root = Path(args.root).resolve()
    if not root.exists() or not root.is_dir():
        print(f"ERROR: root path is not a directory: {root}")
        return 1

    extracted_base = Path(args.extracted_base).resolve() if args.extracted_base else (backend_dir / "extracted").resolve()
    use_ocr = _parse_bool(args.use_ocr)
    checkpoint_file = (
        Path(args.checkpoint_file).resolve()
        if args.checkpoint_file
        else (extracted_base / "run_logs" / "bulk_run_checkpoint.json").resolve()
    )

    discovered = _discover_pdf_folders(root)
    if args.max_folders and args.max_folders > 0:
        discovered = discovered[: args.max_folders]

    if args.reset_checkpoint and checkpoint_file.exists():
        checkpoint_file.unlink()
        print(f"Checkpoint reset: {checkpoint_file}")

    checkpoint = _load_checkpoint(checkpoint_file)
    completed_set = set(str(x) for x in (checkpoint.get("completed_folders") or []))
    if args.resume and completed_set:
        discovered = [p for p in discovered if str(p) not in completed_set]

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir).resolve() if args.output_dir else (extracted_base / "run_logs" / ts)
    output_dir.mkdir(parents=True, exist_ok=True)

    if not discovered:
        print("No folders with PDFs were found.")
        return 0

    print(f"Discovered {len(discovered)} folder(s) with PDFs.")
    if args.dry_run:
        for p in discovered:
            print(str(p))
        print("Dry run complete.")
        return 0

    # Import DB-dependent modules only for real execution (not dry-run).
    from database.connection import SessionLocal  # noqa: E402
    from services.pdf_folder_extractor import process_folder  # noqa: E402

    run_summary: Dict[str, object] = {
        "started_at": datetime.now().isoformat(),
        "root": str(root),
        "extracted_base": str(extracted_base),
        "use_ocr": use_ocr,
        "folders_total": len(discovered),
        "resume_mode": bool(args.resume),
        "checkpoint_file": str(checkpoint_file),
        "folders_processed": 0,
        "folders_failed": 0,
        "pdf_processed_total": 0,
        "inserted_total": 0,
        "errors_total": 0,
        "items": [],
    }
    failed_folders: List[str] = []
    failed_pdf_rows: List[Dict[str, str]] = []

    for idx, folder in enumerate(discovered, start=1):
        rel_parts = list(folder.relative_to(root).parts)
        state_i, year_i, district_i, constituency_i = _infer_meta_from_relative_parts(rel_parts)
        state = args.state or state_i
        year = args.year or year_i
        district = args.district or district_i
        constituency = args.constituency or constituency_i or folder.name

        print(f"[{idx}/{len(discovered)}] Processing: {folder}")
        db = SessionLocal()
        folder_result: Dict[str, object]
        try:
            folder_result = process_folder(
                folder_path=str(folder),
                db=db,
                extracted_base=str(extracted_base),
                constituency_name=constituency,
                state=state,
                year=year,
                district=district,
                use_ocr=use_ocr,
            )
        except Exception as e:
            folder_result = {
                "total_inserted": 0,
                "pdf_processed": 0,
                "errors": [f"{folder.name}: {e!s}"],
                "exception": str(e),
            }
        finally:
            db.close()

        run_summary["folders_processed"] = int(run_summary["folders_processed"]) + 1
        run_summary["pdf_processed_total"] = int(run_summary["pdf_processed_total"]) + int(folder_result.get("pdf_processed") or 0)
        run_summary["inserted_total"] = int(run_summary["inserted_total"]) + int(folder_result.get("total_inserted") or 0)

        errs = folder_result.get("errors") or []
        if errs:
            run_summary["folders_failed"] = int(run_summary["folders_failed"]) + 1
            run_summary["errors_total"] = int(run_summary["errors_total"]) + len(errs)
            failed_folders.append(str(folder))
            for e in errs:
                pdf_name, err_text = _split_error_item(str(e))
                failed_pdf_rows.append(
                    {
                        "folder_path": str(folder),
                        "pdf_name": pdf_name,
                        "error": err_text,
                    }
                )
        else:
            completed_set.add(str(folder))
            checkpoint["completed_folders"] = sorted(completed_set)
            checkpoint["last_updated_at"] = datetime.now().isoformat()
            checkpoint["root"] = str(root)
            checkpoint["extracted_base"] = str(extracted_base)
            _save_checkpoint(checkpoint_file, checkpoint)

        run_summary["items"].append(
            {
                "folder_path": str(folder),
                "state": state,
                "year": year,
                "district": district,
                "constituency_name": constituency,
                "pdf_processed": int(folder_result.get("pdf_processed") or 0),
                "inserted": int(folder_result.get("total_inserted") or 0),
                "errors": [str(x) for x in errs],
            }
        )

    run_summary["finished_at"] = datetime.now().isoformat()

    summary_file = output_dir / "bulk_run_summary.json"
    retry_folders_file = output_dir / "retry_folders.txt"
    retry_pdfs_file = output_dir / "retry_pdfs.csv"

    summary_file.write_text(json.dumps(run_summary, indent=2, ensure_ascii=False), encoding="utf-8")
    retry_folders_file.write_text("\n".join(sorted(set(failed_folders))), encoding="utf-8")

    with retry_pdfs_file.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["folder_path", "pdf_name", "error"])
        writer.writeheader()
        writer.writerows(failed_pdf_rows)

    print("")
    print("Run complete.")
    print(f"Summary: {summary_file}")
    print(f"Retry folders: {retry_folders_file}")
    print(f"Retry PDFs: {retry_pdfs_file}")
    print(f"Checkpoint: {checkpoint_file}")
    print(
        "Totals: "
        f"folders={run_summary['folders_processed']}/{run_summary['folders_total']} "
        f"failed_folders={run_summary['folders_failed']} "
        f"pdf_processed={run_summary['pdf_processed_total']} "
        f"inserted={run_summary['inserted_total']} "
        f"errors={run_summary['errors_total']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
