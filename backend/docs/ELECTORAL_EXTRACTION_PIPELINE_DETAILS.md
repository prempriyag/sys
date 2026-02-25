# Electoral Roll Extraction — Technical Pipeline Details

**Purpose:** Exact technical answers for the current pipeline so improvements can target the right layer.

---

## 1️⃣ PDF Processing Stage

### How we convert PDF to image

- **Libraries (in order of use):**
  1. **pdf2image** (poppler) — primary: `convert_from_path(pdf_path, first_page=1, last_page=max_pages, dpi=dpi)`
  2. **PyMuPDF (fitz)** — fallback if pdf2image fails (e.g. poppler missing): `fitz.open()` → `page.get_pixmap(matrix=mat)` → PIL Image from bytes

- **DPI:** **300** (default). Configurable via `ExtractionConfig.ocr_dpi` and env `EXTRACT_OCR_DPI` (default `"300"`).

- **Page-by-page?** Yes. We render the full PDF to a list of PIL Images (one per page), then process each image in the OCR stage.

- **Cropping margins before OCR?** **No.** We do **not** crop page margins before OCR. Full page image is passed to Tesseract. Only inside the **EPIC-first** path do we **crop per voter card** after detecting EPIC positions (see Segmentation).

### Exact function: PDF → image

```python
# backend/services/electoral_roll_pdf_extractor.py

def _render_pdf_images(
    pdf_path: Path,
    max_pages: int = 1000,
    dpi: int = 300,
) -> List["Any"]:
    images = []
    try:
        from pdf2image import convert_from_path
        images = convert_from_path(str(pdf_path), first_page=1, last_page=max_pages, dpi=dpi)
        return images
    except Exception as e:
        # ... fallback to PyMuPDF (fitz)
        import fitz
        scale = dpi / 72.0
        mat = fitz.Matrix(scale, scale)
        for i in range(min(len(doc), max_pages)):
            pix = doc[i].get_pixmap(matrix=mat, alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            images.append(img)
        # ...
```

---

## 2️⃣ OCR Configuration

### image_to_string() vs image_to_data()

- **Full-page path (EPIC-first step 1 + fallback spatial):** we use **`image_to_data(pil_img, output_type=Output.DICT)`** to get per-word bounding boxes (no config flags passed).
- **Per-card crop (EPIC-first):** we use **`image_to_string(crop)`** on each cropped card image — **no** `--psm`, `--oem`, or `lang` passed.
- **Fallback when spatial/EPIC-first return nothing:** **`image_to_string(img)`** on full page — again no config.

So in the main electoral extractor we use both:
- **image_to_data** on the full page (for EPIC detection and for spatial column/line clustering).
- **image_to_string** on each **cropped card** in the EPIC-first path, and on the full page as last-resort fallback.

### Tesseract config flags

- **In this extractor:** **None.** All `pytesseract.image_to_data(...)` and `pytesseract.image_to_string(...)` calls in `electoral_roll_pdf_extractor.py` are made **without** a `config=` argument. Tesseract uses default PSM (3), default OEM, and default language (usually `eng`).
- **Elsewhere in the repo (not used for roll extraction):**
  - `upload_controller.py`: `image_to_string(box, config="--oem 3 --psm 6")` (different flow).
  - `eci_downloader.py`: `config="--psm 7 -c tessedit_char_whitelist=..."`.
  - `voter_extractor_service.py`: `lang="eng"`.

So for electoral roll extraction: **no --psm, no --oem, no language** are set.

### Preprocessing before OCR

- **Optional**, controlled by `ExtractionConfig.ocr_preprocess` (default **False**). Env: `EXTRACT_OCR_PREPROCESS`.
- When True, **before** OCR we run:
  - **Grayscale** (if 3-channel)
  - **Gaussian blur** (5×5)
  - **Otsu threshold** (binary)
- No denoise, no deskew in code.

```python
def _preprocess_image_for_ocr(img) -> "Any":
    # grayscale, blur, Otsu threshold
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if len(arr.shape) == 3 else arr
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return Image.fromarray(thresh)
```

### Exact OCR usage in the pipeline

- **EPIC-first (data pages, page_idx ≥ 2):**
  - Full page: `pytesseract.image_to_data(pil_img, output_type=Output.DICT)` (no config).
  - Per card: `pytesseract.image_to_string(crop)` (no config).
- **Spatial fallback:** `pytesseract.image_to_data(pil_img, output_type=Output.DICT)` (no config).
- **Final fallback:** `pytesseract.image_to_string(img)` (no config).

---

## 3️⃣ Segmentation Logic

We have **two** segmentation strategies; which one runs depends on the path.

### Path A — EPIC-first (data pages, page index ≥ 2)

1. **Full-page OCR** with **image_to_data** → words with bboxes.
2. **EPIC anchor:** find words matching `_looks_like_epic()` (regex `^[A-Za-z]{2,4}[0-9][A-Za-z0-9/]{4,}$` + ≥6 digits).
3. **Cluster by Y:** sort EPICs by Y; group into rows using vertical gap threshold `max(15, median_h * 1.5)`.
4. **Integrity:** expect 3 EPICs per row, 30 per page; log warning if not.
5. **Card bounding box:** per row, sort EPICs by X; column boundaries = midpoints between adjacent EPICs; card vertical extent = row Y range ± margins.
6. **Crop per card:** `pil_img.crop((x_min, y_min, x_max, y_max))`.
7. **OCR per cropped card:** `pytesseract.image_to_string(crop)` → one text block per card.
8. Parsing: each block is passed to existing card parser (`_parse_one_card_block` via `_parse_voter_cards_from_blocks`).

So in this path we **do crop each voter card before OCR** and run OCR on the crop only.

### Path B — Spatial (full-page OCR, then split text)

1. **Full-page OCR** with **image_to_data** → words with bboxes.
2. **Split by X:** `_cluster_x_into_columns(words, num_cols)` — gap-based column boundaries (largest X-gaps), not fixed zones.
3. **Within each column:** `_cluster_words_into_lines(col_words)` — line clustering by vertical overlap / gap.
4. **Split into card blocks by EPIC anchor:** iterate lines; when a line matches `_looks_like_epic`, start a new card block.
5. **No cropping:** all text comes from one full-page OCR; splitting is by geometry + EPIC in that order.

So in this path we **do not** crop before OCR; we run OCR on the **entire page** and then split the text by columns and EPIC anchors.

### Summary

| Question | Answer |
|----------|--------|
| Cropping each voter card before OCR? | **Yes** on data pages when **EPIC-first** succeeds; **No** when we use **spatial** or any fallback (full-page OCR then split). |
| Splitting by X column zones? | **Yes** in spatial path (gap-based columns). In EPIC-first, columns are derived from EPIC X positions. |
| By EPIC anchor? | **Yes** in both: EPIC-first uses it to find card regions and then crop; spatial uses it to split lines into card blocks. |
| Clustering by Y gap? | **Yes** in EPIC-first (rows); in spatial we use vertical overlap / gap for **lines** within a column. |
| Crop per card or per page? | **Per card** only in EPIC-first. Otherwise **per page**. |

### Full segmentation functions

- **EPIC-first:** `_ocr_page_epic_first()` — ~lines 192–335 (PDF → image already done by caller; input is one page image).
- **Spatial:** `_ocr_page_spatial()` — ~lines 338–435.
- **Column clustering:** `_cluster_x_into_columns()` — ~lines 84–123.
- **Line clustering:** `_cluster_words_into_lines()` — ~lines 126–163.

---

## 3a. Field parsing (keyword-anchor, no positional assumptions)

Parsing is **keyword-anchor based**, not line-index based. TN rolls have variable line order and OCR noise (e.g. "Cender", "Falher", "Housa"), so we:

1. **Normalize OCR text** before parsing: `_normalize_ocr_card_lines()` applies a fixed map (e.g. Cender/Gendar/Gerder→Gender, Housa/Houae→House, Falher/Fatner→Father, Namie/Narne→Name). See `OCR_NORMALIZATION_MAP` and `_OCR_NORM_REGEXES`.
2. **Strip footer lines** from each card block: `_strip_footer_from_card_block()` removes lines containing "age as on", "date of publication", "total pages", "page ", "signature of", "summary of electors" so the last card on a page does not absorb footer text.
3. **Keyword-anchor extraction** in `_parse_card_keyword_anchored()`:
   - **EPIC:** found anywhere in the block via regex (no assumption that line 0 is EPIC).
   - **Age:** `Age\s*[:;]?\s*(\d{1,3})` then fallback `\b(\d{2})\s*(Male|Female)\b`.
   - **Gender:** search for Male/Female on any line (independent of Age).
   - **Relative:** `(Father|Husband|Mother)\s*Name\s*[:;]?\s*(.*)`.
   - **House number:** `House\s*Number\s*[:;]?\s*([0-9A-Za-z\/\-]+)` then first numeric/slash pattern.
   - **Name:** "Name : value" on same line, or first non-keyword line after EPIC.
4. **Gap-fill:** After keyword extraction, the existing label-based loop in `_parse_one_card_block` still runs on the normalized+stripped lines to fill any remaining gaps (next-line values, fuzzy labels).

**No positional parsing:** `_apply_positional_card_parsing` is no longer called; parsing does not assume "line 1 = Name, line 2 = Relative", etc.

**Debug:** When `EXTRACT_DEBUG=1`, the extractor logs at DEBUG level the parsed fields (epic, name, relative, age, gender, house_no) for each card before gap-fill. It also logs **raw card blocks before parsing** (when `EXTRACT_DEBUG_PAGE` matches the page or is unset): total block count for that page, then for each block the lines between `---- CARD BLOCK START (page=N block=i/total, EPICs in block=k) ----` and `---- CARD BLOCK END ----`. Use this to verify segmentation: expect 30 blocks per data page; each block should contain exactly 1 EPIC.

---

## 4️⃣ Validation Rules

### EPIC

- **Detection (tolerant):** `_RE_EPIC_ANCHOR`: `^[A-Za-z]{2,4}[0-9][A-Za-z0-9/]{4,}$` and ≥6 digits.
- **Validation (strict):** `RE_EPIC_VALID`: `^[A-Za-z]{3}[0-9]{6,7}(/[0-9]+)?$` (case-insensitive).
- **Normalization:** strip, upper, remove spaces; fix slash in numeric part; prefix corrections (e.g. WOD→WQD); digit 0→6 only if result still invalid and correction yields valid.

### Age

- **Bounds:** 18–120 (constants `AGE_MIN`, `AGE_MAX` in `_validate_and_score_records`).
- Missing age → warning `age_missing` and status can be "Missing Age"; out-of-range → `age_out_of_range`.

### Gender

- **Normalization:** `_normalize_gender()` maps to `M` / `F` / `O` (Third), with fuzzy tokens for Male/Female/Third/Other/transgender etc.
- **Validation:** `VALID_GENDERS = {"M", "F", "O", "MALE", "FEMALE", "OTHER"}`; single-char `M`/`F`/`O` accepted. Invalid/missing → warning and status "Gender Invalid" or "Needs Review".

### House number

- **Cleanup:** `_normalize_house_no()` — in digit/slash context, replace C and O with 0 (e.g. 8/1C00 → 8/100).
- **Validation:** length ≤ 15; if longer, truncate and warn `house_no_too_long`. Date-like values rejected for house_no.

### Validation code location

- **`_validate_and_score_records()`** — ~lines 979–1095: sets `validation_status` (Valid / EPIC Invalid / Missing Age / Gender Invalid / Needs Review), confidence score, duplicate flag, and all above checks.
- **`_normalize_epic()`** — ~lines 908–944.
- **`_normalize_gender()`** — ~lines 947–976.
- **`_normalize_house_no()`** — ~lines 844–858.

---

## 5️⃣ Accuracy Issue Examples

We do **not** have a concrete sample incorrect vs correct JSON plus the exact OCR raw text for that card in the repo. To fill this in you would need to:

1. Run extraction on a known PDF.
2. Pick one card where the output is wrong (e.g. wrong name/age/gender/house or mixed with another card).
3. Capture:
   - The **extracted record** (e.g. one element of `records` in the API response).
   - The **expected correct** record.
   - The **OCR raw text** for that one card (e.g. the list of lines for that card from `_ocr_page_epic_first` or `_ocr_page_spatial`).

Once you have that triple (wrong JSON, correct JSON, OCR text for that card), you can add it here and use it to see whether the failure is in segmentation, parsing, or validation.

---

## 6️⃣ Performance Constraints

- **Pages per PDF:** No fixed limit in code; `max_pages` defaults to 1000; config `ocr_max_pages` (env `EXTRACT_OCR_MAX_PAGES`, default 1000). Typical TN roll part is on the order of tens of pages.
- **Extraction time:** Not measured or logged in the extractor; no timing decorator or benchmark. Depends on DPI (300), number of pages, and whether EPIC-first or full-page OCR is used (EPIC-first does 1 full-page `image_to_data` + 30× `image_to_string` per data page).
- **Hardware:** No GPU usage in this extractor. Tesseract runs on CPU; EasyOCR fallback is `gpu=False`. So effectively **server CPU only**.

---

## Very Important Question — Direct Answer

**Are we cropping each voter card before OCR or running OCR on the entire page and then splitting text?**

- **When EPIC-first is used (data pages, page index ≥ 2):** We **crop each voter card** (using bounding boxes from EPIC positions), then run **OCR on each cropped image**. So for those pages we **do** crop before OCR.
- **When EPIC-first is not used or fails:** We run OCR on the **entire page** (once with `image_to_data`) and then **split the text** by column clustering and EPIC anchors. So in that case we **do not** crop before OCR; we split after.

So the pipeline is **hybrid**: crop-per-card when EPIC-first succeeds, full-page-then-split otherwise.

---

## Where to Look When Accuracy Fails

| Layer | What to check |
|-------|----------------|
| PDF conversion | DPI (300), poppler vs fitz, no margin crop. |
| OCR config | No PSM/OEM/lang in this extractor; per-card uses `image_to_string` with no config. |
| Segmentation | EPIC-first vs spatial; row/column boundaries; EPICs per page ≠ 30 logged. |
| Parsing | Keyword-anchor extraction in `_parse_card_keyword_anchored` (no line-index assumptions); OCR normalization and footer strip; then label-based gap-fill in `_parse_one_card_block`. |
| Validation | EPIC regex, age 18–120, gender normalization, house cleanup and length. |

Providing one concrete **incorrect output JSON**, **expected JSON**, and **OCR raw text for that card** will make it possible to say exactly which layer is failing.

---

## Diagnostic debugging (one page, one card)

To get **runtime evidence** for one wrong record (which layer is failing), the extractor can write six diagnostic artifacts when **EXTRACT_DEBUG** is set.

### Enable

Set before running extraction (e.g. in shell or in your run config):

- **EXTRACT_DEBUG** = `1` or `true` or `yes` — turn on diagnostic output.
- **EXTRACT_DEBUG_PAGE** = page number (1-based), e.g. `3` — page to debug (default `3`).
- **EXTRACT_DEBUG_CARD** = card index on that page (0-based), e.g. `0` — which card (default `0`).
- **EXTRACT_DEBUG_DIR** = directory path — where to write files (default `debug`).

Example (PowerShell):

```powershell
$env:EXTRACT_DEBUG = "1"
$env:EXTRACT_DEBUG_PAGE = "3"
$env:EXTRACT_DEBUG_CARD = "0"
# then run your extraction (API or script)
```

### Outputs (all under `EXTRACT_DEBUG_DIR`, default `debug/`)

| # | File | Content |
|---|------|---------|
| 0 | **Logs** | When **EXTRACT_DEBUG=1**: for the debug page (or all pages if EXTRACT_DEBUG_PAGE=0), logs **Page N: total card blocks = M** and for each block **---- CARD BLOCK START (page=N block=i/M, EPICs in block=k) ----** followed by each line and **---- CARD BLOCK END ----**. Use to verify segmentation (expect 30 blocks per data page; each block should have exactly 1 EPIC). |
| 1 | `full_page_ocr_<page>.json` | Raw full-page OCR: every word with `word`, `x`, `y`, `width`, `height`, `confidence` (from `image_to_data`). |
| 2 | `epic_detection_<page>.json` | EPIC detection: `epic_candidates` (text, x, y), `epics_per_row`, `total_epic_count`. |
| 3 | `card_01.png` | Cropped image for the chosen card (so you can check if cropping is correct). |
| 4 | `card_01_ocr.txt` | Exact raw text from `pytesseract.image_to_string(crop)` for that card (before parsing). |
| 5 | `parsed_record.json` | The parsed record (wrong output): `epic`, `name`, `father_name`, `house_no`, `age`, `gender`, plus `validation_status`, `confidence_score`. |
| 6 | `expected_record.json` | Template with same keys and empty values — fill manually with correct values for comparison. |

Diagnostics are only written when the **OCR path** runs (e.g. image-only PDF or when OCR is explicitly used). For the chosen page we use EPIC-first; if that page has no EPICs or segmentation fails, 1–4 may still be written for that page, but 5–6 depend on having a record for that page/card after parsing.

To turn off: unset **EXTRACT_DEBUG** (or set to `0`/`false`).

### Debug run checklist (before sending for diagnosis)

1. **Set env and run once (use 400 DPI for clearer OCR on small fonts):**
   ```powershell
   $env:EXTRACT_DEBUG = "1"
   $env:EXTRACT_DEBUG_PAGE = "3"
   $env:EXTRACT_DEBUG_CARD = "0"
   $env:EXTRACT_OCR_DPI = "400"
   ```
   Then run extraction (API or script) on a PDF that uses the OCR path.

2. **Collect these and share contents:**
   - `parsed_record.json`
   - `card_01_ocr.txt`
   - `epic_detection_3.json`
   - (Optional) `full_page_ocr_3.json`

3. **Note:** Does `card_01.png` look correct (one full card, no half-card or two cards)?

4. **Diagnosis (decision tree):**
   - **Crop wrong** (half card, two cards, shifted) → segmentation layer (row gap, padding, or fixed 3×10 grid).
   - **Crop OK but OCR text bad** → OCR layer (DPI, deskew, preprocessing, `eng+tam`).
   - **OCR text OK but JSON wrong** → parsing layer (regex, label matching, line grouping).
   - **JSON OK but marked invalid** → validation layer (EPIC/gender/age/house normalization).

With that, the failing layer can be fixed in a targeted way. If segmentation is unstable, consider replacing EPIC-based clustering with **fixed-grid cropping** (3 columns × 10 rows) for TN’s fixed layout.
