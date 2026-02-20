# AI Instruction Document – ECI Voter Roll Extractor

**Purpose:** Technical specification for AI agents (Cursor, internal AI) working on the ECI electoral roll extraction system.

---

## Objective

Build and maintain a FastAPI service that extracts structured voter data from Election Commission of India (ECI) PDF voter rolls. The system must support:

- **Text-based PDFs** (digital/native PDFs with selectable text)
- **Scanned PDFs** (image-based, require OCR)

---

## System Architecture

```
                Upload PDF
                     │
                     ▼
        Detect PDF Type (Auto)
             │               │
     Text-Based PDF      Scanned PDF
             │               │
  pdfplumber + PyMuPDF   OCR Engine (Tesseract/EasyOCR)
             │               │
  Block/Table Parsing   Image Preprocess (OpenCV)
             │               │
         Regex Structuring + OCR-tolerant patterns
             │               │
         Data Validation & Cleaning
                     │
                 JSON Output
                     │
         (Optional) Store in Database
```

---

## Functional Requirements

1. **Accept PDF upload** via FastAPI endpoint `POST /api/v1/extract-voters`
2. **Auto-detect PDF type** using text-length heuristic (avg chars per sampled page < 50 → scanned)
3. **Text-based path:** Use pdfplumber + PyMuPDF, block/table extraction, regex parsing
4. **Scanned path:** Convert to images (300 DPI), preprocess (grayscale, blur, Otsu threshold), apply Tesseract or EasyOCR fallback
5. **Return JSON** with `data`, `metadata`, `extraction_mode`, `errors`, `warnings`
6. **Validate** EPIC format, age range, gender, house_no (reject date-like values)

---

## Data Fields (Output Schema)

| Field | Type | Description |
|-------|------|-------------|
| serial_number | int/str | From card position |
| epic_number | str | EPIC/Voter ID (pattern: `[A-Z]{3}[0-9]{6,7}`) |
| name | str | Elector name (normalized uppercase) |
| relative_name | str | Father/Husband/Mother name |
| house_number | str | House/door number |
| age | int | 18–120 |
| gender | str | M, F, or O |
| booth_number | str | Part/booth number |
| part_number | str | Part No. if different |
| page_number | int | Source page |
| constituency_name | str | Assembly constituency |
| address | str | Full address (if available) |

---

## Key Code Paths

| Component | Path |
|-----------|------|
| Extraction service | `backend/services/voter_extractor_service.py` |
| Electoral roll parser | `backend/services/electoral_roll_pdf_extractor.py` |
| API controller | `backend/controllers/sir/extractor_controller.py` |
| Config | `backend/config/extraction_config.py` |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/extract-voters` | Upload PDF, extract voters. Form params: `file`, `constituency_name`, `booth_number`, `force_ocr`, `use_preprocessing` |
| GET | `/api/v1/extractor/health` | Health check; reports Tesseract, EasyOCR, OpenCV, PyMuPDF, pdfplumber availability |

---

## Non-Functional Requirements

- Handle 1000+ page PDFs (memory-efficient, page-by-page)
- Max file size: 100 MB (configurable via `EXTRACT_MAX_FILE_MB`)
- Extraction timeout: 600s (configurable via `EXTRACT_TIMEOUT`)
- Error handling: per-page failures should not abort full extraction
- Logging: structured logs for debugging

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| EXTRACT_MIN_TEXT_CHARS | 50 | Min avg chars per page to consider PDF as text-based |
| EXTRACT_SAMPLE_PAGES | 5 | Pages to sample for type detection |
| EXTRACT_OCR_DPI | 300 | DPI for OCR image conversion |
| EXTRACT_OCR_MAX_PAGES | 1000 | Max pages to process via OCR |
| EXTRACT_OCR_PREPROCESS | true | Apply OpenCV preprocessing for scanned PDFs |
| EXTRACT_MAX_FILE_MB | 100 | Max upload file size (MB) |
| EXTRACT_TIMEOUT | 600 | Extraction timeout (seconds) |

---

## Accuracy Strategy

- Extract **per block/card**, not full page text
- Use OCR-tolerant regex (e.g. "Genocr", "Gendcr", "Ago", "Houso No")
- Validate EPIC: `[A-Z]{3}[0-9]{6,7}`
- Reject house_no that looks like dates (e.g. 01.01.2020)
- Normalize names to uppercase

---

## Dependencies

```
pymupdf
pdfplumber
pytesseract
easyocr
opencv-python-headless
pdf2image
```

**System:** Tesseract OCR must be installed for best OCR results. EasyOCR is fallback when Tesseract is not in PATH.

---

## Response Format

```json
{
  "total_records": 150,
  "data": [ { "epic_number": "ABC1234567", "name": "JOHN DOE", ... } ],
  "metadata": { "constituency_name": "...", "booth_number": "...", "pages_processed": 20 },
  "extraction_mode": "text",
  "errors": [],
  "warnings": [ "Row 5: Duplicate EPIC ABC1234567" ],
  "raw_page_texts": [ { "page": 1, "length": 1200, "text": "..." } ]
}
```

---

## Microservice Architecture (Target)

```
Extractor Service  →  Normalizer Service  →  Ingestion/DB  →  Matching Engine  →  Analytics
```

Keep extraction logic separate from normalization and matching.

---

## Optional Improvements

- PaddleOCR instead of Tesseract
- LayoutParser for box detection
- ML model for field classification
- Extraction confidence score per record
- Background job queue for large PDFs
- Progress reporting for long extractions
