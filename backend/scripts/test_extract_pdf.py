#!/usr/bin/env python
"""Test Textract extraction on a single PDF. Usage:
  cd backend && python scripts/test_extract_pdf.py "download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam/2026-EROLLGEN-S22-106-SIR-FinalRoll-Revision1-ENG-2-WI.pdf"
"""
import os
import sys
from pathlib import Path

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.chdir(Path(__file__).resolve().parent.parent)

def main():
    from dotenv import load_dotenv
    load_dotenv()

    if len(sys.argv) < 2:
        pdf = Path("download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam/2026-EROLLGEN-S22-106-SIR-FinalRoll-Revision1-ENG-2-WI.pdf")
    else:
        pdf = Path(sys.argv[1])

    if not pdf.exists():
        print(f"PDF not found: {pdf}")
        sys.exit(1)

    print(f"Extracting: {pdf.name}")
    from services.textract_extractor import extract_from_pdf_textract

    result = extract_from_pdf_textract(
        str(pdf),
        default_constituency_name="83 - Gobichettipalayam",
    )
    recs = result.get("records", [])
    meta = result.get("metadata", {})

    print(f"Records: {len(recs)} | Pages: {meta.get('pages_processed', '?')}")
    if recs:
        print("\nFirst 5:")
        for i, r in enumerate(recs[:5]):
            print(f"  {i+1}. EPIC={r.get('epic_number')} | {r.get('name')} | Age={r.get('age')} | {r.get('gender')}")


if __name__ == "__main__":
    main()
