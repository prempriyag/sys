"""
Debug script: trace PDF extraction step-by-step.
Run: python scripts/debug_pdf_extraction.py path/to/your.pdf

Shows what happens at each stage so you can see where data is lost.
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/debug_pdf_extraction.py <path_to_pdf>")
        print("Example: python scripts/debug_pdf_extraction.py C:/Users/ABCOM/Desktop/voter_roll.pdf")
        sys.exit(1)
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        sys.exit(1)

    with open(pdf_path, "rb") as f:
        content = f.read()
    print(f"=== PDF: {pdf_path} ({len(content):,} bytes) ===\n")

    # Step 1: pdfplumber text extraction
    print("--- Step 1: pdfplumber (text extraction) ---")
    try:
        from services.pdf_parser import parse_electoral_roll_pdf, _parse_text_to_records
        records, const, booth = parse_electoral_roll_pdf(content, max_pages=3)
        print(f"  Records: {len(records)}")
        if records:
            print(f"  Sample: {records[0]}")
        else:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                page = pdf.pages[0]
                text = page.extract_text() or ""
                print(f"  Page 1 text length: {len(text)} chars")
                print(f"  First 500 chars: {repr(text[:500])}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # Step 2: electoral_roll_pdf_extractor (table + text + OCR)
    print("\n--- Step 2: extract_from_pdf (tables + text + OCR) ---")
    try:
        from services.electoral_roll_pdf_extractor import extract_from_pdf
        result = extract_from_pdf(pdf_path, use_ocr=True)
        recs = result.get("records", [])
        print(f"  Records: {len(recs)}")
        if recs:
            print(f"  Sample: {recs[0]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # Step 3: PaddleOCR
    print("\n--- Step 3: PaddleOCR ---")
    try:
        from services.paddle_ocr_service import is_available, ocr_pdf_bytes_to_records
        avail = is_available()
        print(f"  Available: {avail}")
        if avail:
            def pdf_to_imgs(b, dpi=150):
                from controllers.sir.upload_controller import _pdf_bytes_to_images
                return _pdf_bytes_to_images(b, dpi)
            recs = ocr_pdf_bytes_to_records(content, convert_from_bytes=pdf_to_imgs, dpi=150)
            print(f"  Records: {len(recs)}")
            if recs:
                print(f"  Sample: {recs[0]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    # Step 4: Tesseract grid
    print("\n--- Step 4: Tesseract (grid 3x10) ---")
    try:
        from controllers.sir.upload_controller import _pdf_bytes_to_images, _extract_page
        import pytesseract
        images = _pdf_bytes_to_images(content, 150)
        print(f"  Pages: {len(images)}")
        if images:
            w, h = images[0].size
            cropped = images[0].crop((0, int(h*0.06), w, h - int(h*0.04)))
            recs = _extract_page(cropped, 3, 10)
            print(f"  Records (3x10): {len(recs)}")
            if len(recs) < 5:
                recs2 = _extract_page(cropped, 2, 15)
                print(f"  Records (2x15): {len(recs2)}")
                if len(recs2) > len(recs):
                    recs = recs2
            if recs:
                print(f"  Sample: {recs[0]}")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n=== Done ===")

if __name__ == "__main__":
    main()
