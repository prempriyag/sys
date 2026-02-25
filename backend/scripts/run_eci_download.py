"""
Standalone ECI electoral roll download script.
Runs in a separate Python process to avoid uvicorn/anyio event loop conflicts on Windows.
Usage: python -m scripts.run_eci_download --output /path/to/output.pdf [--state "Andhra Pradesh" ...]
Exits 0 on success, 1 on failure. Writes PDF to --output path.
"""
import argparse
import sys
from pathlib import Path

# Add backend to path so we can import services
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))


def main():
    parser = argparse.ArgumentParser(description="ECI electoral roll download (standalone)")
    parser.add_argument("--output", "-o", required=True, help="Output PDF path")
    parser.add_argument("--state", default="Tamil Nadu", help="State name")
    parser.add_argument("--revyear", default="2026", help="Revision year")
    parser.add_argument("--district", default="Chennai", help="District")
    parser.add_argument("--ac", default="11 - Dr.Radhakrishnan Nagar", dest="ac_name", help="Assembly Constituency name")
    parser.add_argument("--language", default="English", help="Select Language (e.g. English, Tamil, Kannada)")
    parser.add_argument("--manual-captcha", action="store_true", help="Type captcha manually in the browser (default).")
    parser.add_argument("--no-manual-captcha", action="store_true", help="Use OCR for captcha (may fail on ECI).")
    args = parser.parse_args()
    # Default = manual captcha; --no-manual-captcha switches to OCR.
    manual_captcha = not bool(args.no_manual_captcha)

    from services.eci_downloader import download_eci_roll_sync

    pdf_bytes, error_msg = download_eci_roll_sync(
        state=args.state,
        revyear=args.revyear,
        district=args.district,
        ac_name=args.ac_name,
        language=args.language,
        manual_captcha=manual_captcha,
    )
    if error_msg:
        print(f"Error: {error_msg}", file=sys.stderr)
        sys.exit(1)
    if not pdf_bytes:
        print("Error: No PDF downloaded", file=sys.stderr)
        sys.exit(1)
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(pdf_bytes)
    print(f"Saved to {out}")
    sys.exit(0)


if __name__ == "__main__":
    main()
