# OCR PDF Detector – Why It Can Take So Long & Files Involved

## Why 600000ms (10 min) Timeout Is Exceeded

The **OCR PDF Detector** (`http://localhost:5173/upload/ocr-pdf-detector`) can run for a long time because:

1. **Per-page work**
   - Each page is rendered to an image at **200–300 DPI** (pdf2image or PyMuPDF).
   - Each image is optionally **preprocessed** (OpenCV: grayscale, blur, Otsu threshold).
   - **OCR** runs on every image (Tesseract or EasyOCR). OCR is CPU-heavy and scales with resolution and page count.

2. **No page limit by default (before fix)**
   - Backend used `ocr_max_pages = 1000`. A 50+ page scanned PDF could mean 50+ full-page OCR runs, which easily exceeds 10 minutes.

3. **First-time EasyOCR**
   - If Tesseract is missing and EasyOCR is used, the first request loads PyTorch and the model (often 1–3+ minutes) before any page is processed.

4. **No DB during extraction**
   - The timeout happens during **extraction only**. The database is used only when you click **Upload to database** after extraction. So DB is not the cause of the long time.

## What We Changed to Reduce Timeouts

- **Max pages (OCR)** on the page (default **20**). The request sends `max_pages` so the backend only processes that many pages. Lower = faster.
- **Frontend timeout** increased from 10 min to **15 min** for the extract request.
- **Backend** accepts `max_pages` form field and passes it as `ocr_max_pages` into the extraction pipeline.

If it still times out: lower **Max pages (OCR)** (e.g. 10 or 15) and/or turn off **Use preprocessing**.

---

## All Files Used for OCR PDF Detector

### Frontend (Vite/React)

| File | Role |
|------|------|
| `frontend/src/pages/SIR/OcrPdfDetector.tsx` | Page UI: PDF upload, constituency/booth, **Max pages**, Force OCR, Use preprocessing, Extract, Upload to DB, table, JSON/CSV download |
| `frontend/src/services/api.ts` | `extractVotersV1()`, `uploadOcrRecords()`, `extractorHealth()`, `getDbInfo()`, `debugPdfRoll()` – **timeout 15 min** for extract |
| `frontend/src/config/api.ts` | `EXTRACTOR_V1_EXTRACT`, `EXTRACTOR_V1_OCR_UPLOAD`, `EXTRACTOR_V1_HEALTH`, `SIR_DEBUG_PDF`, `DB_INFO` |
| `frontend/src/App.tsx` | Route `/upload/ocr-pdf-detector` → `OcrPdfDetector` |
| `frontend/src/config/menus/sir.ts` | Menu entry for OCR PDF Detector |

### Backend (FastAPI)

| File | Role |
|------|------|
| `backend/main.py` | Mounts routers (extractor, upload, etc.), CORS, app entry |
| `backend/controllers/sir/extractor_controller.py` | **POST /api/v1/extract-voters** (file, constituency_name, booth_number, force_ocr, use_preprocessing, **max_pages**), **POST /api/v1/ocr-upload**, **GET /api/v1/extractor/health** |
| `backend/services/voter_extractor_service.py` | `extract_voters()`: text vs scanned detection, calls `electoral_roll_pdf_extractor.extract_from_pdf(..., use_ocr=...)`, `validate_records()` |
| `backend/services/electoral_roll_pdf_extractor.py` | PDF→images (`_render_pdf_images`), OCR (`_extract_blocks_via_ocr`, `_extract_text_via_ocr_with_preprocessing`), Tesseract/EasyOCR, scipy line clustering, parsing to voter records; uses **ocr_max_pages** |
| `backend/config/extraction_config.py` | `ocr_dpi`, **ocr_max_pages** (default 1000), `ocr_preprocess`, `max_file_size_mb`, `extraction_timeout_seconds` |
| `backend/database/connection.py` | SQLAlchemy engine, `get_db()` – used for **ocr-upload** and DB info |
| `backend/models/sir/ocr_voter_upload.py` | Model for table **ocr_voter_uploads** (where “Upload to database” saves) |
| `backend/create_sir_tables.py` | Creates `ocr_voter_uploads` and other SIR tables |

### Database (PostgreSQL – sys DB)

| Table / use | When used |
|-------------|-----------|
| **ocr_voter_uploads** | When you click **Upload to database** after extraction (inserts rows from the current table on the page). |
| **DB connection** | Only for `/api/v1/ocr-upload` and for “DB Detail” (e.g. `/api/db-info` if present). **Not** used during the long extract request. |

So the long time is **not** DB-related; it’s **PDF rendering + OCR** on the backend. Limiting **Max pages (OCR)** and optionally turning off preprocessing keeps extraction under the 15 min timeout.

---

## Shutdown traceback after “Spatial OCR complete”

If you see a **KeyboardInterrupt** or **threading._shutdown** traceback in the terminal **after** a line like “Spatial OCR complete: 20 pages, 114 records extracted”, the extraction **succeeded** and the response was sent. The traceback is from Python shutting down (e.g. server reload or Ctrl+C) while the executor or EasyOCR/PyTorch threads are still cleaning up. You can ignore it; no data is lost.

**When you press Ctrl+C to stop the server**, you may see an ERROR traceback with `KeyboardInterrupt` and then `asyncio.exceptions.CancelledError`. This is **normal shutdown** (uvicorn/Starlette tearing down). Ignore it; the server has stopped.
