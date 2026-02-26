# Hybrid OCR Pipeline (95%+ Accuracy Target)

The electoral roll extractor supports an optional **hybrid pipeline** for production-grade accuracy on scanned ECI PDFs.

## New Fields on Each Record

| Field | Description |
|-------|-------------|
| **epic_confidence** | 0–1 score: format (3 letters + 6–7 digits), allowed prefix, length 10 |
| **confidence_score** | Overall record score (existing; EPIC, name, age, gender, house_no weights) |
| **quality_flag** | `"ok"` if confidence_score ≥ 0.85, else `"review"` |
| **source_block** | Raw text lines for the card (OCR path only); empty for table/text extraction |

## Configuration (extraction_config)

Pass these in the API or when calling `extract_from_pdf(..., extraction_config={...})`:

| Key | Description |
|-----|-------------|
| **use_enhance** | If `True`, use CLAHE + sharpen instead of basic Otsu preprocessing (3–5% accuracy gain on low-contrast scans). |
| **debug_dir** | If set (e.g. `"debug"`), save per-page images with green boxes around adaptively detected card regions to that directory. |

Example (API): the OCR path uses `extraction_config` from the request; you can add `use_enhance: true` and `debug_dir: "debug"` in the frontend or via env if we expose them.

## Image Enhancement

- **Basic preprocess** (default when “Use preprocessing” is on): grayscale, Gaussian blur, Otsu threshold.
- **Enhanced preprocess** (when `use_enhance=True`): CLAHE contrast, blur, sharpen kernel. Use for low-contrast or faint scans.

## EPIC Confidence

`_epic_confidence(epic)` returns 0–1:

- +0.6 if format matches `^[A-Za-z]{3}[0-9]{6,7}(/[0-9]+)?$`
- +0.3 if 3-letter prefix is in allowed list (WQD, WOD, FBT, ABC, …)
- +0.1 if length is 10

## Adaptive Grid Detection (Visual Debug)

- **`_detect_voter_boxes_adaptive(page_img)`**: Finds card-like regions by contour area clustering (median ± 60–150%). Returns `(x, y, w, h)` list.
- **`_save_debug_page_with_boxes(page_img, boxes, path)`**: Draws green rectangles and saves the image.
- When `debug_dir` is set, the extractor runs adaptive detection on each page image and saves `page_1_debug.jpg`, `page_2_debug.jpg`, etc.

## Multi-Pass OCR Voting

- **`_multi_ocr_vote(img, configs)`**: Runs Tesseract with multiple PSM/OEM configs and returns the longest cleaned text. Ready for use in a future per-card or EPIC-only path (e.g. when using contour-based card crops).

## Suggested Next Steps

1. **Expose in UI**: Add “Use enhanced preprocessing” and “Save debug images to folder” on the OCR PDF Detector page (optional form fields or query params).
2. **Per-card OCR path**: When `use_hybrid_contour=True`, render page → `_detect_voter_boxes_adaptive` → crop each box → `_multi_ocr_vote` per crop → parse and merge with existing logic.
3. **AI cleanup**: For records with `quality_flag == "review"` and `confidence_score < 0.7`, optionally send `source_block` to an LLM for correction (separate service).
