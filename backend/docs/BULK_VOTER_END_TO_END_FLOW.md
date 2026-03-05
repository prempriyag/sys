# Bulk Voter Extraction End-to-End Flow

## Scope

This document describes the complete production flow for extracting voter records from electoral-roll PDFs and inserting into PostgreSQL with:

- `1 box = 1 voter` OCR parsing
- batched inserts (`100` rows per commit)
- throttle (`sleep(2)`) after each full 100-row commit
- checkpoint/resume in folder runner
- retry artifacts for failed folders/PDFs

---

## Components

- API controller: `backend/controllers/sir/upload_controller.py`
- OCR + parsing engine: `backend/services/electoral_roll_pdf_extractor.py`
- Bulk engine (file upload path): `backend/services/bulk_electoral_roll_engine.py`
- Folder processor (server-folder path): `backend/services/pdf_folder_extractor.py`
- DB model: `backend/models/sir/bulk_voter_import.py`
- DB session/engine config: `backend/database/connection.py`
- Batch runner script: `backend/scripts/run_bulk_roll_folders.py`

---

## Data Model Target

Primary table: `voter_data` (SQLAlchemy model `BulkVoterImport`)

Important fields:
- `pdf_name`, `page_number`, `box_id`
- `epic_number`, `name`, `relative_name`, `relation_type`
- `age`, `gender`, `house_no`, `address`
- `constituency_name`, `year`, `booth_number`, `source_pdf`
- `confidence_score`, `confidence`

Primary uniqueness:
- preferred: `UNIQUE(pdf_name, box_id)` (`uq_voter_data_pdf_box`)
- legacy fallback supported: `UNIQUE(epic_number)`

---

## Entry Points

### 1) API: folder or uploaded files
- `POST /api/upload/bulk-electoral-roll`
- `POST /api/upload/bulk-electoral-roll-stream` (SSE progress)

### 2) CLI batch runner (recommended for very large volumes)
- `python backend/scripts/run_bulk_roll_folders.py --root "<download_root>"`

---

## Processing Flow (Per PDF)

1. PDF is loaded.
2. OCR/text extraction is selected:
   - text layer path when available
   - OCR path for scanned pages
3. For scanned voter pages, engine enforces per-card extraction:
   - box/grid segmentation
   - one block sanitized to one voter span (cuts spillover at next EPIC)
4. Card parser extracts:
   - EPIC, name, relative, age, gender, house no
5. Validation + scoring:
   - EPIC normalization/correction
   - record confidence score
   - warnings/anomaly tags
6. Rows are prepared for DB insertion.
7. DB insert occurs in 100-row batches with conflict-safe mode.
8. After each full batch of 100 commit:
   - commit transaction
   - `sleep(2)` throttle
9. Final partial batch commits without sleep.
10. Process moves to next PDF.

---

## Insert Strategy

### Conflict-safe insert
At runtime, schema is inspected:
- if `pdf_name + box_id` unique exists: `ON CONFLICT (pdf_name, box_id) DO NOTHING`
- else if legacy `epic_number` unique exists: `ON CONFLICT (epic_number) DO NOTHING`
- else insert without conflict clause

### Batch and throttle
- batch size: `100`
- full batch commit (`len(batch) >= 100`) triggers `time.sleep(2)`
- final short batch commits immediately

This is implemented in:
- `bulk_electoral_roll_engine.py`
- `pdf_folder_extractor.py`

---

## DB Stability

Connection engine includes:
- `pool_pre_ping=True`
- `pool_recycle=3600`

Session handling:
- sessions are not kept open for all files in runner context
- errors trigger rollback
- sessions close in `finally`

---

## Large-Scale Runner Flow (`run_bulk_roll_folders.py`)

1. Discover all folders containing PDFs under `--root`.
2. Optional metadata inference from folder structure:
   - `state/year/district/constituency`
3. Process folders one-by-one using `process_folder(...)`.
4. Persist run outputs:
   - `bulk_run_summary.json`
   - `retry_folders.txt`
   - `retry_pdfs.csv`
5. Checkpoint file persists completed folders.

### Checkpoint behavior

Checkpoint default:
- `backend/extracted/run_logs/bulk_run_checkpoint.json`

Flags:
- `--resume`: skip folders already in checkpoint
- `--checkpoint-file <path>`: custom checkpoint path
- `--reset-checkpoint`: clear checkpoint before run

Checkpoint updates after each successful folder.

---

## Commands

### Dry run (discover only)
```bash
python backend/scripts/run_bulk_roll_folders.py \
  --root "c:\Users\ABCOM\Desktop\sys\backend\download" \
  --dry-run
```

### Full run
```bash
python backend/scripts/run_bulk_roll_folders.py \
  --root "c:\Users\ABCOM\Desktop\sys\backend\download"
```

### Resume from checkpoint
```bash
python backend/scripts/run_bulk_roll_folders.py \
  --root "c:\Users\ABCOM\Desktop\sys\backend\download" \
  --resume
```

### Reset checkpoint and rerun
```bash
python backend/scripts/run_bulk_roll_folders.py \
  --root "c:\Users\ABCOM\Desktop\sys\backend\download" \
  --reset-checkpoint
```

---

## Monitoring and Verification

API verification endpoints:
- `GET /api/upload/bulk-electoral-roll-count`
- `GET /api/upload/bulk-electoral-roll-data`
- `GET /api/upload/bulk-electoral-roll-quality`

Runner artifacts:
- summary JSON for totals and per-folder stats
- retry folder list
- retry PDF list with errors

---

## Failure and Recovery

- Folder-level errors are captured and continue with next folder.
- Per-PDF errors are collected into `retry_pdfs.csv`.
- Resume mode avoids reprocessing completed folders.
- Conflict-safe insert avoids duplicate row crashes.

---

## Accuracy Note

True 100% OCR accuracy cannot be guaranteed on all scanned PDFs.
Current pipeline is optimized to prevent common corruption:
- cross-card mixing prevention
- EPIC normalization/repair
- structured parsing and validation
- confidence scoring

