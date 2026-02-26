# OCR PDF Detector – Library flow

This describes which libraries the **OCR PDF Detector** (route `/upload/ocr-pdf-detector`) uses and how they are chained.

## End-to-end flow

1. **Frontend**  
   - Page: `frontend/src/pages/SIR/OcrPdfDetector.tsx`  
   - Calls: `extractVotersV1(formData)` → `POST /api/v1/extract-voters`

2. **Backend API**  
   - Controller: `backend/controllers/sir/extractor_controller.py`  
   - Endpoint: `POST /api/v1/extract-voters`  
   - Reads PDF into a temp file, then calls the extractor service.

3. **Extractor service**  
   - Entry: `backend/services/voter_extractor_service.py` → `extract_voters()`  
   - Decides **text vs scanned** via `is_scanned_pdf()` (PyMuPDF), then:
     - **Text PDF**: uses `electoral_roll_pdf_extractor.extract_from_pdf(..., use_ocr=False)` (pdfplumber + PyMuPDF).
     - **Scanned PDF** (or `force_ocr=True`): uses same `extract_from_pdf(..., use_ocr=True)`, which triggers the OCR path below.

4. **OCR path (scanned PDF)**  
   - Implemented in: `backend/services/electoral_roll_pdf_extractor.py`  
   - Flow:
     - **PDF → images**: `pdf2image` (poppler) or **PyMuPDF (fitz)** to render pages at configured DPI.
     - **Preprocessing** (optional): **OpenCV (cv2)** + **PIL** for grayscale, Gaussian blur, Otsu threshold.
     - **OCR engine** (in order):
       - **Tesseract** via **pytesseract** (primary): `image_to_data()` for bounding boxes, then spatial clustering into columns and lines; or `image_to_string()` for flat text.
       - **EasyOCR** (fallback only if `ALLOW_EASYOCR_FALLBACK=true` and Tesseract fails): `reader.readtext()` per image.
     - **Line/column grouping**: custom gap-based X clustering for columns; **scipy** (`scipy.cluster.hierarchy.fclusterdata`) for grouping words into lines by Y position (when available), else overlap-based fallback.
     - **Parsing**: regex and heuristics in `electoral_roll_pdf_extractor` to turn text blocks into voter records (EPIC, name, age, gender, etc.).

5. **Validation**  
   - `voter_extractor_service.validate_records()` cleans and validates EPIC, age, gender, etc., and returns structured JSON with `data`, `metadata`, `errors`, `warnings`.

## Libraries used in OCR PDF Detector flow

| Purpose              | Library        | Where used |
|----------------------|----------------|------------|
| PDF → images         | **pdf2image** (poppler) or **PyMuPDF (fitz)** | `_render_pdf_images()` / voter_extractor_service |
| Image preprocessing  | **OpenCV (cv2)** + **PIL** | `_preprocess_image_for_ocr()` |
| OCR (primary)        | **Tesseract** via **pytesseract** | `_ocr_page_spatial()`, `_extract_text_via_ocr_with_preprocessing()` |
| OCR (fallback)       | **EasyOCR**    | When Tesseract fails and `ALLOW_EASYOCR_FALLBACK=true` |
| Line clustering      | **scipy** (`scipy.cluster.hierarchy.fclusterdata`) | `_cluster_words_into_lines()` in electoral_roll_pdf_extractor (optional) |
| Text PDF tables      | **pdfplumber** | `extract_from_pdf()` when not using OCR |
| PDF text / metadata | **PyMuPDF (fitz)** | `is_scanned_pdf()`, fallback page rendering |

## Scipy in this flow

**scipy** is used in the **OCR path** when grouping OCR words into text lines:

- In **electoral_roll_pdf_extractor**: words from Tesseract `image_to_data()` have (x, y, w, h). They are first clustered into **columns** (gap-based X clustering), then within each column into **lines** by Y position. Line grouping can use **`scipy.cluster.hierarchy.fclusterdata`** on word Y coordinates (with a distance threshold), so words on the same horizontal line get the same cluster label. If scipy is not available, an overlap-based fallback groups words into lines without scipy.

So the OCR PDF Detector flow uses: **Tesseract (or EasyOCR) + OpenCV + PyMuPDF/pdf2image + scipy** (for line clustering when available).
