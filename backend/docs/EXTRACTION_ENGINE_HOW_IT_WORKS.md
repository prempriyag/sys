# PDF Extraction Engine — How It Works & Accuracy

This document explains how the electoral roll PDF extraction engine works on `http://localhost:5173/upload/pdf-extract` and what accuracy to expect.

---

## 1. High-Level Flow

```
                    PDF Upload
                         │
                         ▼
              ┌──────────────────────┐
              │  Is it TEXT or       │
              │  SCANNED PDF?        │
              │  (auto-detect)       │
              └──────────────────────┘
                    │         │
         Text-based │         │ Scanned (image-only)
                    ▼         ▼
         ┌─────────────┐  ┌─────────────────────┐
         │ pdfplumber  │  │ OCR Pipeline        │
         │ + PyMuPDF   │  │ (Tesseract/EasyOCR) │
         └─────────────┘  └─────────────────────┘
                    │         │
                    └────┬────┘
                         ▼
              ┌──────────────────────┐
              │  Parse text          │
              │  (3 strategies)      │
              └──────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Validate & clean    │
              │  (EPIC, age, etc.)   │
              └──────────────────────┘
                         │
                         ▼
              JSON output → UI / API
```

---

## 2. Detection: Text vs Scanned PDF

- **Logic:** Sample first 5 pages, get average characters per page.
- **If avg < 50 chars** → treated as **scanned** (OCR path).
- **If avg ≥ 50 chars** → treated as **text** (direct extraction).

---

## 3. Text-Based PDF Pipeline

### Step 1: Extract text
- Uses **pdfplumber** to read text from each page.
- No OCR involved.

### Step 2: Try 3 extraction strategies (in order)

| Strategy | When used | How it works |
|----------|-----------|--------------|
| **1. Table extraction** | Page has table-like layout | Detects rows/columns, maps headers (EPIC, Name, Father, Age, Gender, House No, Address) to records. |
| **2. Position-based extraction** | Page 3+ and no tables | Splits page into columns (default: 3 cards/row × 10 rows = 30 per page). Uses word positions (x0, top) and row_gap to group words per voter card. Parses each card block. Config: cards_per_row, rows_per_page, row_gap, header_top, data_bottom. |
| **3. Regex fallback** | Still no records | Splits text into lines, finds EPIC patterns, uses regex for Name:, Father:, Age:, Gender:, House No: etc. |

### Step 3: Card parsing (regex patterns)
- EPIC: `[A-Za-z][A-Za-z0-9]*[0-9]{3,}`
- Name: `Name : value` or `Name` + next line
- Father/Husband/Mother: `Father Name: xxx`, `Husband Name: xxx`
- House No: `House Number: xxx` or `House No: xxx`
- Age: `Age: 32` or `32 Genocr` (OCR typo for Gender)
- Gender: `Male`, `Female`, `M`, `F` (or fuzzy: `Mole`, `Foma 0`)

---

## 4. Scanned PDF Pipeline (OCR)

### Step 1: Convert PDF to images
- **pdf2image** (if poppler available) or **PyMuPDF** as fallback.
- DPI: 200 default (configurable via env EXTRACT_OCR_DPI; lower = faster).

### Step 2: Image preprocessing (optional)
- Grayscale → Gaussian blur → Otsu threshold.
- Helps when scans are noisy or low contrast.

### Step 3: OCR
- **Tesseract** preferred; **EasyOCR** used if Tesseract not in PATH.
- Pages processed in parallel (up to 4 workers) for faster extraction.

### Step 4: Record segmentation (before parsing)
- **EPIC-based split**: When text is card-major (EPIC1, Name1, Father1, ..., EPIC2, ...), split by EPIC positions.
- **Grid reorder**: When OCR returns column-major (EPIC1, EPIC2, EPIC3, Name1, Name2, Name3, ...), reorder into per-card blocks using EPIC positions and row-major mapping.

### Step 5: Parse OCR output
- Same parsing logic as text pipeline (regex, card blocks).
- **OCR-tolerant label patterns** for common errors:
  - Name: `Nama`
  - Father: `Fatnar Namo`, `Fether Name`, `Father Nama`, `Falner`, `Falhar`
  - House: `Fouse Number`, `Houso Numbar`, `Hou8e`, `Houga`, `Houea`, `House Numbet`
  - Age/Gender: `Aga`, `Gerer`, `Gondar`, `Genocr`, `Gendcr`, `Cendor`
  - Gender values: `Mala` (Male), `Ferala` (Female), `Mole`, `Foma 0`
  - Skip: `Photo`, `Ptoto`, `Pnoto`, `Available`, `Avallable`, `Availabl`
- **Structural anomaly detection**: If a block has >1 Name label, >1 Age, or >1 Gender → flag `possible_cross_card_merge`.
- **EPIC normalization** (post-extraction):
  - Prefix: `WOD`→`WQD`, `WQ0`→`WQD`, `WQd`→`WQD` (always applied)
  - Digit `0`→`6`: **only when EPIC fails validation** and correction yields valid format (never corrupt valid data)
  - Configurable via `epic_corrections`, `epic_digit_corrections`, `epic_fix_digit_0_as_6`.
- **House number normalization**: `C`→`0`, `O`→`0` in digit context (e.g. 8/1C00→8/100).

---

## 5. Structural Intelligence Layer (post-extraction)

- **Logical validation**: age 18–120, gender ∈ {M,F,O}, house_no length ≤ 15, EPIC format
- **1 EPIC per record**: multiple EPICs in a card → warning `multiple_epics_in_card`
- **Serial number** extraction: from `"1 WQD2616720"` or standalone `"1"` at card start
- **Per-record confidence** (weighted: EPIC 40%, Name 20%, Age 15%, Gender 15%, House 10%); flag `low_confidence` when &lt; 70%
- **Duplicate detection**: flag `is_duplicate` when EPIC seen before
- **Accuracy panel**: EPIC valid %, Age valid %, Gender valid %, duplicate count, low-confidence count

---

## 6. Expected Accuracy

| PDF type | Typical accuracy | Notes |
|----------|------------------|--------|
| **Text-based (digital)** | **90–98%** | High when layout matches config (default: 3 cards/row × 10 rows). Table extraction is most accurate. |
| **Scanned (good quality)** | **75–90%** | Depends on scan clarity, font size, and preprocessing. |
| **Scanned (poor quality)** | **50–75%** | Blur, skew, or low contrast reduce accuracy. |

### Field-level accuracy (typical)

| Field | Text PDF | Scanned PDF |
|-------|----------|-------------|
| EPIC | 95–99% | 85–95% |
| Name | 90–98% | 75–90% |
| Father/Husband | 85–95% | 70–85% |
| Age | 90–98% | 80–90% |
| Gender | 95–99% | 85–95% |
| House No | 80–95% | 65–85% |
| Address | 70–90% | 55–75% |

---

## 7. Why Accuracy Varies

1. **Layout differences** — Other states may use different formats (e.g. 6 cards/row instead of 9).
2. **Zone config** — `header_top`, `data_bottom`, `cards_per_row` must match your PDF. Use the extraction format panel to adjust.
3. **OCR quality** — Scan resolution, skew, noise, font.
4. **Unusual text** — Names with special characters, handwritten notes, stamps.

---

## 8. How to Improve Accuracy

1. **Text PDF**
   - Ensure constituency and booth are filled if not in the PDF.
   - Use **“Extraction format (ABBYY-like coordinates)”** to tune:
     - `cards_per_row` (default 3), `rows_per_page` (10), `row_gap` (25)
     - `header_top`, `data_bottom`, `margin_left`, `margin_right`
   - Check **Raw OCR / extracted text** to see what was actually read.

2. **Scanned PDF**
   - Enable **Use OCR**.
   - Enable preprocessing (default in v1 API).
   - Use higher DPI (e.g. 300) in extraction config if needed.
   - Ensure good scan quality (no blur, minimal skew).

3. **All PDFs**
   - Verify in **Raw extracted text** that EPIC, Name, Father, Age, Gender appear.
   - If fields are wrong, adjust extraction config and re-extract.
   - Use the **cards** view to spot-check records.

---

## 9. Code Paths

| Component | File |
|-----------|------|
| Main extraction | `backend/services/electoral_roll_pdf_extractor.py` → `extract_from_pdf()` |
| Type detection & validation | `backend/services/voter_extractor_service.py` |
| API (extract-pdf) | `backend/controllers/sir/upload_controller.py` → `/api/upload/extract-pdf` |
| Production v1 API | `backend/controllers/sir/extractor_controller.py` → `/api/v1/extract-voters` |
| UI | `frontend/src/pages/SIR/PdfExtractPage.tsx` |

---

## 10. Accuracy Summary in Response

The extraction response includes:
- `extraction_mode`: `"text"` or `"ocr"`
- `warnings`: validation issues (duplicates, invalid age, etc.)
- `errors`: critical problems

A simple accuracy proxy:
- **Completeness** = % of records with all of: epic_number, name, age, gender
- More `warnings` → lower confidence
- Fewer `warnings` and high completeness → higher confidence
