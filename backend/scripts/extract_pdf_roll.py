"""
Extract voter records from an ECI-style electoral roll PDF.
Usage:
  python scripts/extract_pdf_roll.py "C:/path/to/roll.pdf"
  python scripts/extract_pdf_roll.py "C:/path/to/roll.pdf" --constituency "Chennai North" --booth 20
  python scripts/extract_pdf_roll.py "C:/path/to/roll.pdf" --output extracted.csv
  python scripts/extract_pdf_roll.py "C:/path/to/roll.pdf" --load-pre  # Load into Pre-SIR table (requires DB)
"""
import sys
import os
import argparse
import csv

# Run from backend directory
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def main():
    parser = argparse.ArgumentParser(description="Extract voter records from ECI electoral roll PDF")
    parser.add_argument("pdf_path", help="Path to the PDF file (e.g. 2026-EROLLGEN-S22-11-SIR-DraftRoll-Revision1-ENG-20-WI_removed.pdf)")
    parser.add_argument("--constituency", "-c", default=None, help="Constituency name if not in PDF")
    parser.add_argument("--booth", "-b", default=None, help="Booth/Part number if not in PDF")
    parser.add_argument("--output", "-o", default=None, help="Output CSV path. If omitted, prints summary and first 10 rows.")
    parser.add_argument("--load-pre", action="store_true", help="Load extracted records into Pre-SIR table (database)")
    parser.add_argument("--load-post", action="store_true", help="Load extracted records into Post-SIR table (database)")
    parser.add_argument("--debug", action="store_true", help="Print PDF structure (first page text + table preview) and exit")
    parser.add_argument("--ocr", action="store_true", help="Use OCR for scanned/image PDFs (requires pdf2image, pytesseract, Tesseract)")
    args = parser.parse_args()

    pdf_path = args.pdf_path
    if not os.path.isfile(pdf_path):
        print(f"Error: File not found: {pdf_path}")
        sys.exit(1)

    from services.electoral_roll_pdf_extractor import extract_from_pdf, debug_pdf

    if args.debug:
        print("=== PDF DEBUG (first page) ===\n")
        info = debug_pdf(pdf_path)
        print(f"First page text length: {info['first_page_text_length']} chars")
        print(f"Tables found (default): {info['table_count']}")
        print(f"Tables found (text strategy): {info['table_count_text_strategy']}")
        print("\n--- First 2500 chars of text ---")
        print(info["first_page_text"][:2500])
        print("\n--- Table preview (first 3 rows each) ---")
        for tbl in info.get("table_preview", []):
            print(tbl)
        return

    print(f"Extracting from: {pdf_path}" + (" (with OCR)" if args.ocr else ""))
    result = extract_from_pdf(
        pdf_path,
        default_constituency_name=args.constituency,
        default_booth_number=args.booth,
        use_ocr=args.ocr,
    )
    records = result.get("records", [])
    metadata = result.get("metadata", {})

    print(f"Extracted {len(records)} records.")
    print(f"Metadata: constituency={metadata.get('constituency_name')}, booth={metadata.get('booth_number')}")

    if not records:
        print("No records extracted.")
        print("  - If this is a scanned/image PDF (no selectable text), try: --ocr")
        print("  - For --ocr without installing Tesseract, use: pip install easyocr  (script will use EasyOCR automatically)")
        print("  - To inspect the PDF structure, run: --debug")
        print("  - PDFs with a text layer should have table columns like EPIC No, Name, Father's Name, Age, Sex, House No, Address.")
        sys.exit(1)

    if args.load_pre or args.load_post:
        from database.connection import SessionLocal
        from controllers.sir.upload_controller import _records_to_voters_pre, _records_to_voters_post
        db = SessionLocal()
        try:
            if args.load_pre:
                n = _records_to_voters_pre(db, records)
                print(f"Loaded {n} records into Pre-SIR table.")
            if args.load_post:
                n = _records_to_voters_post(db, records)
                print(f"Loaded {n} records into Post-SIR table.")
        finally:
            db.close()

    if args.output:
        with open(args.output, "w", newline="", encoding="utf-8") as f:
            cols = ["epic_number", "name", "relative_name", "age", "gender", "house_no", "address", "booth_number", "constituency_name"]
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            w.writerows(records)
        print(f"Wrote {len(records)} rows to {args.output}")
    else:
        print("\nFirst 10 rows (sample):")
        for i, r in enumerate(records[:10]):
            print(f"  {i+1}. {r.get('name')} | EPIC: {r.get('epic_number')} | Age: {r.get('age')} | {r.get('gender')}")
        print("\nUse --output file.csv to export all, or --load-pre / --load-post to load into database.")


if __name__ == "__main__":
    main()
