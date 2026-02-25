from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import StreamingResponse
import tempfile
import os
import re
import shutil
import platform
import logging
import io
import csv
import pandas as pd
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# ------------------ OCR IMPORTS + FIX ------------------

try:
    from pdf2image import convert_from_bytes
    import pytesseract

    # Configure Tesseract properly for Windows
    if platform.system() == "Windows":
        if not shutil.which("tesseract"):
            tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
                logger.info(f"Tesseract manually configured: {tesseract_path}")
            else:
                logger.error("Tesseract not found at expected location.")
        else:
            logger.info("Tesseract found in system PATH.")

except ImportError as e:
    logger.error(f"OCR libraries not installed: {e}")
    convert_from_bytes = None
    pytesseract = None

# ============================== AUTO-DETECT SMART OCR ENGINE ==============================
OCR_DPI = 150
OCR_SCALE = 0.70
OCR_PAGE_WORKERS = 6
BATCH_PDF_WORKERS = 4
BATCH_MAX_FILES = 100

# ------------------ DATABASE IMPORTS ------------------

from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.voter import VoterPre, VoterPost
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from services.normalization import NormalizationService
from services.pdf_parser import parse_electoral_roll_pdf, electoral_roll_records_to_csv_rows

router = APIRouter(
    prefix="/api/upload",
    tags=["Upload"]
)

# ------------------ HELPER FUNCTIONS ------------------

def get_or_create_constituency(db: Session, constituency_name: str, district: str = None, state: str = None):
    constituency = db.query(Constituency).filter(
        Constituency.name.ilike(constituency_name)
    ).first()

    if not constituency:
        constituency = Constituency(
            name=constituency_name,
            district=district or "",
            state=state or ""
        )
        db.add(constituency)
        db.commit()
        db.refresh(constituency)

    return constituency


def get_or_create_booth(db: Session, constituency_id: int, booth_number: str, location_name: str = None):
    booth = db.query(Booth).filter(
        Booth.constituency_id == constituency_id,
        Booth.booth_number == booth_number
    ).first()

    if not booth:
        booth = Booth(
            constituency_id=constituency_id,
            booth_number=booth_number,
            location_name=location_name or ""
        )
        db.add(booth)
        db.commit()
        db.refresh(booth)

    return booth


# ------------------ PRE SIR ------------------

@router.post("/pre-sir")
async def upload_pre_sir(file: UploadFile = File(...), db: Session = Depends(get_db)):

    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        required_columns = [
            'epic_number', 'name', 'relative_name', 'age',
            'gender', 'house_no', 'address',
            'booth_number', 'constituency_name'
        ]

        missing = [col for col in required_columns if col not in df.columns]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing)}"
            )

        voters = []
        batch_size = 1000

        for idx, row in df.iterrows():
            try:
                constituency = get_or_create_constituency(
                    db, str(row['constituency_name']).strip()
                )

                booth = get_or_create_booth(
                    db,
                    constituency.id,
                    str(row['booth_number']).strip(),
                    str(row.get('location_name', '')).strip()
                )

                name = str(row['name']).strip() if pd.notna(row['name']) else ""
                relative_name = str(row['relative_name']).strip() if pd.notna(row['relative_name']) else ""
                address = str(row['address']).strip() if pd.notna(row['address']) else ""

                voter = VoterPre(
                    epic_number=str(row['epic_number']).strip() if pd.notna(row['epic_number']) else None,
                    name=name,
                    relative_name=relative_name,
                    age=int(row['age']) if pd.notna(row['age']) else None,
                    gender=NormalizationService.normalize_gender(str(row['gender']) if pd.notna(row['gender']) else ""),
                    house_no=str(row['house_no']).strip() if pd.notna(row['house_no']) else None,
                    address=address,
                    normalized_name=NormalizationService.normalize_name(name),
                    normalized_address=NormalizationService.normalize_text(address),
                    booth_id=booth.id
                )

                voters.append(voter)

                if len(voters) >= batch_size:
                    db.bulk_save_objects(voters)
                    db.commit()
                    voters = []

            except Exception as e:
                logger.error(f"Row {idx} error: {e}")

        if voters:
            db.bulk_save_objects(voters)
            db.commit()

        return {"message": f"Uploaded {len(df)} Pre-SIR records"}

    except Exception as e:
        logger.exception("Pre-SIR upload failed")
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ POST SIR ------------------

@router.post("/post-sir")
async def upload_post_sir(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))

        voters = []
        batch_size = 1000

        for idx, row in df.iterrows():
            try:
                constituency = get_or_create_constituency(
                    db, str(row['constituency_name']).strip()
                )

                booth = get_or_create_booth(
                    db,
                    constituency.id,
                    str(row['booth_number']).strip(),
                    str(row.get('location_name', '')).strip()
                )

                name = str(row['name']).strip() if pd.notna(row['name']) else ""
                address = str(row['address']).strip() if pd.notna(row['address']) else ""

                voter = VoterPost(
                    epic_number=str(row['epic_number']).strip() if pd.notna(row['epic_number']) else None,
                    name=name,
                    relative_name=str(row['relative_name']).strip() if pd.notna(row['relative_name']) else "",
                    age=int(row['age']) if pd.notna(row['age']) else None,
                    gender=NormalizationService.normalize_gender(str(row['gender']) if pd.notna(row['gender']) else ""),
                    house_no=str(row['house_no']).strip() if pd.notna(row['house_no']) else None,
                    address=address,
                    normalized_name=NormalizationService.normalize_name(name),
                    normalized_address=NormalizationService.normalize_text(address),
                    booth_id=booth.id
                )

                voters.append(voter)

                if len(voters) >= batch_size:
                    db.bulk_save_objects(voters)
                    db.commit()
                    voters = []

            except Exception as e:
                logger.error(f"Row {idx} error: {e}")

        if voters:
            db.bulk_save_objects(voters)
            db.commit()

        return {"message": f"Uploaded {len(df)} Post-SIR records"}

    except Exception as e:
        logger.exception("Post-SIR upload failed")
        raise HTTPException(status_code=500, detail=str(e))


# ------------------ OCR PDF CONVERTER ------------------

# @router.post("/convert-scanned-pdf")
# async def convert_scanned_pdf(file: UploadFile = File(...)):

#     if not file.filename or not file.filename.lower().endswith('.pdf'):
#         raise HTTPException(status_code=400, detail="Only PDF files allowed")

#     if convert_from_bytes is None or pytesseract is None:
#         raise HTTPException(status_code=500, detail="OCR libraries not installed")

#     try:
#         content = await file.read()
#         images = convert_from_bytes(content)

#         all_text = []
#         for img in images:
#             text = pytesseract.image_to_string(img)
#             all_text.append(text)

#         combined = "\n\n".join(all_text)
#         blocks = re.split(r"Photo Available|\n\s*\n", combined)

#         records = []

#         for blk in blocks:
#             txt = blk.strip()
#             if not txt:
#                 continue

#             record = {
#                 'name': None,
#                 'ref_id': None,
#                 'house_number': None,
#                 'age': None,
#                 'gender': None
#             }

#             m = re.search(r"Name\s*[:\-]?\s*(.+)", txt, re.IGNORECASE)
#             if m:
#                 record['name'] = m.group(1).strip()

#             m = re.search(r"(\d+)\s+([A-Z0-9]+)", txt)
#             if m:
#                 record['ref_id'] = m.group(2).strip()

#             m = re.search(r"House\s*Number\s*[:\-]?\s*(.+)", txt, re.IGNORECASE)
#             if m:
#                 record['house_number'] = m.group(1).strip()

#             m = re.search(r"Age\s*[:\-]?\s*(\d+)", txt, re.IGNORECASE)
#             if m:
#                 record['age'] = int(m.group(1))

#             m = re.search(r"Gender\s*[:\-]?\s*(Male|Female|M|F)", txt, re.IGNORECASE)
#             if m:
#                 record['gender'] = m.group(1)

#             if record['name'] or record['ref_id']:
#                 records.append(record)

#         output = io.StringIO()
#         import csv
#         writer = csv.DictWriter(output, fieldnames=records[0].keys() if records else [])
#         writer.writeheader()
#         writer.writerows(records)

#         output.seek(0)

#         return StreamingResponse(
#             io.BytesIO(output.getvalue().encode('utf-8')),
#             media_type="text/csv",
#             headers={
#                 "Content-Disposition": f'attachment; filename="{file.filename}_converted.csv"'
#             }
#         )

#     except Exception as e:
#         logger.exception("OCR conversion failed")
#         raise HTTPException(status_code=500, detail=str(e))

def clean_ocr_text(text):
    """Helper to remove noise and extra whitespace from OCR output."""
    return " ".join(text.replace("\n", " ").split()).strip()


def clean_epic(epic: str) -> str:
    """Normalize EPIC to 3 letters + 7 digits; fix common OCR mistakes (O→0, I→1, Z→2)."""
    if not epic:
        return ""
    epic = epic.upper().replace("/", "")
    epic = epic.replace("O", "0").replace("I", "1").replace("Z", "2")
    if re.match(r"^[A-Z]{3}\d{7}$", epic):
        return epic
    return ""


def clean_ocr_field(value: str) -> str:
    """Clean OCR field: strip, uppercase, remove invalid chars, collapse spaces."""
    if not value or not isinstance(value, str):
        return ""
    value = value.strip().upper()
    value = re.sub(r"[^\w\s\-]", "", value, flags=re.IGNORECASE)
    return " ".join(value.split())


def clean_house_number(value: str) -> str:
    """Remove 'Photo' / 'Photo Available' etc. that OCR picks up next to house number."""
    if not value or not isinstance(value, str):
        return ""
    value = value.strip()
    value = re.sub(r"\s*Photo\s*(?:Available|Not|Submitted)?\s*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^\s*Photo\s*(?:Available|Not|Submitted)?\s*", "", value, flags=re.IGNORECASE)
    return value.strip()


# Tesseract whitelist for voter card OCR (reduces misreads)
_TESS_WHITELIST = "--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:/- "


def _extract_page_to_records(cropped_page, ncol, nrow):
    """Extract voter records from one cropped page for given grid (ncol x nrow). Uses strict EPIC + whitelist."""
    try:
        from PIL import Image
    except ImportError:
        Image = None
    c_width, c_height = cropped_page.size
    if OCR_SCALE < 1.0 and Image is not None:
        try:
            new_w = max(100, int(c_width * OCR_SCALE))
            new_h = max(100, int(c_height * OCR_SCALE))
            resample = getattr(Image, "Resampling", None)
            resample = resample.LANCZOS if resample and hasattr(resample, "LANCZOS") else (getattr(Image, "LANCZOS", 1) or 1)
            cropped_page = cropped_page.resize((new_w, new_h), resample)
            c_width, c_height = cropped_page.size
        except Exception:
            pass
    box_w = c_width // ncol
    box_h = c_height // nrow
    out = []
    for r in range(nrow):
        for c in range(ncol):
            box = cropped_page.crop((c * box_w, r * box_h, c * box_w + box_w, r * box_h + box_h))
            text = pytesseract.image_to_string(box, config=_TESS_WHITELIST)
            if not text.strip():
                continue
            epic_match = re.search(r"\b([A-Z]{3}[\dOIZ]{7})\b", text, re.IGNORECASE)
            if not epic_match:
                continue
            epic = clean_epic(epic_match.group(1).upper())
            if not epic:
                continue
            name_match = re.search(r"Name\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
            name = clean_ocr_field(name_match.group(1).strip()) if name_match else ""
            house_match = re.search(r"House\s*Number\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
            house_no = house_match.group(1).strip() if house_match else ""
            house_no = clean_house_number(house_no)
            age_match = re.search(r"Age\s*[:\-]?\s*(\d+)", text)
            age = int(age_match.group(1)) if age_match else None
            if "Female" in text:
                gender = "Female"
            elif "Male" in text:
                gender = "Male"
            else:
                gender = ""
            rel_match = re.search(r"(Father|Husband|Mother)(?:'s)?\s*Name\s*[:\-]?\s*(.+)", text, re.IGNORECASE)
            rel_role = (rel_match.group(1) or "") if rel_match else ""
            rel_name = clean_ocr_field(rel_match.group(2).strip()) if rel_match and len(rel_match.groups()) >= 2 else ""
            card_no = None
            cn_m = re.search(r"^\s*(\d+)\b", text) or re.search(r"\b(\d{2,5})\b", text)
            if cn_m:
                try:
                    card_no = int(cn_m.group(1))
                except (ValueError, IndexError):
                    pass
            out.append({
                "Card No": card_no,
                "Voter ID (EPIC)": epic,
                "Name": name,
                "Relation": rel_role or "",
                "Relative Name": rel_name,
                "House Number": house_no,
                "Age": age,
                "Gender": gender,
            })
    return out


def auto_detect_grid(cropped_page):
    """Try candidate grid layouts and return the one that yields the most records."""
    candidate_layouts = [
        (3, 10), (2, 15), (4, 8),
        (3, 8), (2, 10),
        (3, 6), (2, 8),
        (3, 2), (2, 3),
    ]
    best_records = []
    for ncol, nrow in candidate_layouts:
        records = _extract_page_to_records(cropped_page, ncol, nrow)
        if len(records) > len(best_records):
            best_records = records
    return best_records


def _run_ocr_pdf_to_records(content: bytes) -> list:
    """Run auto-detect OCR on PDF: all pages, 4%-98% crop, auto_detect_grid per page, order preserved, dedupe by EPIC."""
    if not content or convert_from_bytes is None or pytesseract is None:
        return []
    images = convert_from_bytes(content, dpi=OCR_DPI)
    if not images:
        return []

    def process_page(page):
        width, height = page.size
        cropped = page.crop((0, int(height * 0.04), width, int(height * 0.98)))
        return auto_detect_grid(cropped)

    all_records = []
    with ThreadPoolExecutor(max_workers=min(OCR_PAGE_WORKERS, len(images))) as executor:
        for page_records in executor.map(process_page, images):
            all_records.extend(page_records)

    ordered = []
    seen = set()
    for record in all_records:
        epic = record["Voter ID (EPIC)"]
        if epic not in seen:
            seen.add(epic)
            ordered.append(record)
    return ordered

@router.post("/convert-scanned-pdf")
async def convert_scanned_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF allowed")
    try:
        content = await file.read()
        ordered_records = _run_ocr_pdf_to_records(content)
        output = io.StringIO()
        fieldnames = ["Serial No", "Card No", "Voter ID (EPIC)", "Name", "Relation", "Relative Name", "House Number", "Age", "Gender"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for serial, r in enumerate(ordered_records, start=1):
            row = {**r, "Serial No": serial}
            writer.writerow(row)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=voter_list.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR Processing Error: {str(e)}")


# ------------------ SOP: PARSE ELECTORAL ROLL PDF (TEXT OR SCANNED) ------------------

@router.post("/parse-electoral-roll-pdf")
async def parse_electoral_roll_pdf_endpoint(
    file: UploadFile = File(...),
    constituency_name: str = Form(""),
    booth_number: str = Form(""),
):
    """
    SOP TN-VOTER-ANALYTICS-01: Parse ECI electoral roll PDF (digital or scanned).
    Tries text extraction first (pdfplumber); falls back to OCR for scanned PDFs.
    Returns CSV ready for Pre-SIR/Post-SIR upload (epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name).
    Optionally pass constituency_name and booth_number (or Part number) to tag all records.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    const_name = constituency_name.strip() or None
    booth_no = booth_number.strip() or None

    # 1) Try text-based extraction first (digital PDFs like ECI draft rolls)
    records, parsed_const, parsed_booth = parse_electoral_roll_pdf(
        content,
        default_constituency_name=const_name,
        default_booth_number=booth_no,
        default_part_number=booth_no,
    )

    # 2) If very few records, assume scanned and fall back to fast OCR (150 DPI, resize, parallel pages)
    from_ocr = False
    if len(records) < 5 and convert_from_bytes is not None and pytesseract is not None:
        try:
            ocr_list = _run_ocr_pdf_to_records(content)
            if ocr_list:
                records = [
                    {
                        "card_no": r.get("Card No"),
                        "epic_number": r.get("Voter ID (EPIC)", ""),
                        "name": r.get("Name", ""),
                        "relation": r.get("Relation", ""),
                        "relative_name": r.get("Relative Name", ""),
                        "house_no": r.get("House Number", ""),
                        "age": r.get("Age"),
                        "gender": r.get("Gender", ""),
                        "address": "",
                    }
                    for r in ocr_list
                ]
                from_ocr = True
                parsed_const = parsed_const or const_name or "Unknown"
                parsed_booth = parsed_booth or booth_no or "1"
        except Exception as ocr_err:
            logger.warning("OCR fallback failed: %s", ocr_err)

    const_final = parsed_const or const_name or "Unknown"
    booth_final = parsed_booth or booth_no or "1"
    output = io.StringIO()
    if from_ocr and records:
        fieldnames = ["Serial No", "Card No", "Voter ID (EPIC)", "Name", "Relation", "Relative Name", "House Number", "Age", "Gender", "Booth Number", "Constituency Name"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for serial, r in enumerate(records, start=1):
            writer.writerow({
                "Serial No": serial,
                "Card No": r.get("card_no") or "",
                "Voter ID (EPIC)": r.get("epic_number", ""),
                "Name": r.get("name", ""),
                "Relation": r.get("relation", ""),
                "Relative Name": r.get("relative_name", ""),
                "House Number": r.get("house_no", ""),
                "Age": r.get("age") or "",
                "Gender": r.get("gender", ""),
                "Booth Number": booth_final,
                "Constituency Name": const_final,
            })
    else:
        csv_rows = electoral_roll_records_to_csv_rows(
            records,
            constituency_name=const_final,
            booth_number=booth_final,
        )
        fieldnames = ["epic_number", "name", "relative_name", "age", "gender", "house_no", "address", "booth_number", "constituency_name"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(csv_rows)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="electoral_roll_parsed.csv"'},
    )