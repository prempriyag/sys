from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import StreamingResponse
import asyncio
import tempfile
import os
import re
import shutil
import platform
import logging
import io
import csv
import zipfile
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

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

# Faster OCR: lower DPI + resize page (fewer pixels = much faster)
OCR_DPI = 150
OCR_SCALE = 0.55   # resize page to 55% before OCR
OCR_PAGE_WORKERS = 6   # process this many pages in parallel per PDF
BATCH_PDF_WORKERS = 4  # process this many PDFs in parallel in batch
BATCH_MAX_FILES = 100  # max PDFs per batch request

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


def clean_ocr_field(value: str) -> str:
    """SOP 3.2: Clean OCR junk from a single field (name, relation_name, house_number)."""
    if not value or not isinstance(value, str):
        return ""
    value = value.strip()
    # Remove trailing hyphens, pipe, brackets (e.g. "Jayamani -", "Syedalifathima - | ]")
    value = re.sub(r"\s*[-|\]\[]+\s*$", "", value)
    value = value.strip()
    # SOP: uppercase for consistency
    value = value.upper()
    # Remove remaining junk characters but keep letters, digits, spaces, hyphen in middle
    value = re.sub(r"[^\w\s\-/]", "", value, flags=re.IGNORECASE)
    return " ".join(value.split())


def clean_house_number(value: str) -> str:
    """Remove 'Photo' / 'Photo Available' etc. that OCR picks up next to house number."""
    if not value or not isinstance(value, str):
        return ""
    value = value.strip()
    value = re.sub(r"\s*Photo\s*(?:Available|Not|Submitted)?\s*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^\s*Photo\s*(?:Available|Not|Submitted)?\s*", "", value, flags=re.IGNORECASE)
    return value.strip()


def _extract_page_to_records(cropped_page, ncol, nrow):
    """Extract voter records from one cropped page (3x10 or 2x15 grid). Returns list of dicts with Card No, Voter ID (EPIC), etc."""
    try:
        from PIL import Image
    except ImportError:
        pass
    c_width, c_height = cropped_page.size
    if OCR_SCALE < 1.0:
        try:
            from PIL import Image
            new_w = max(100, int(c_width * OCR_SCALE))
            new_h = max(100, int(c_height * OCR_SCALE))
            resample = getattr(Image, "Resampling", None)
            resample = resample.LANCZOS if resample and hasattr(resample, "LANCZOS") else (getattr(Image, "LANCZOS", 1) or 1)
            cropped_page = cropped_page.resize((new_w, new_h), resample)
            c_width, c_height = cropped_page.size
        except Exception:
            pass
    box_w, box_h = c_width // ncol, c_height // nrow
    out = []
    for r in range(nrow):
        for c in range(ncol):
            voter_box = cropped_page.crop((c * box_w, r * box_h, c * box_w + box_w, r * box_h + box_h))
            text = pytesseract.image_to_string(voter_box, config="--oem 3 --psm 6")
            if not text.strip():
                continue
            epic_match = re.search(r"\b([A-Z]{2,4}\d{6,8})\b|([A-Z]{2}/\d{2}/\d{3}/\d{6})", text, re.IGNORECASE)
            if not epic_match:
                continue
            epic = (epic_match.group(1) or epic_match.group(2) or "").strip().upper()
            if len(epic) < 5:
                continue
            lines = text.split("\n")
            card_no = None
            first_line = (lines[0].strip() if lines else "") or text.strip()[:80]
            cn_m = re.match(r"^\s*(\d+)\b", first_line) or re.search(r"\b(\d{2,5})\b", first_line)
            if cn_m:
                try:
                    card_no = int(cn_m.group(1))
                except (ValueError, IndexError):
                    pass
            name = rel_name = rel_role = house_no = ""
            age = None
            gender = ""
            for line in lines:
                cl = line.strip()
                if re.search(r"Name\s*:", cl, re.I) and not name:
                    name = cl.split(":")[-1].strip()
                elif re.search(r"(Father|Husband|Mother|Other)(?:'s)?\s*Name\s*:", cl, re.I):
                    rel_role = re.search(r"(Father|Husband|Mother|Other)", cl, re.I).group(1)
                    rel_name = cl.split(":")[-1].strip()
                elif re.search(r"(?:S/O|D/O|W/O|C/O)\s*[:\-]?\s*", cl, re.I) and not rel_name:
                    rel_role = "Other"
                    rel_name = re.sub(r"^(?:S/O|D/O|W/O|C/O)\s*[:\-]?\s*", "", cl, flags=re.I).strip()
                elif re.search(r"House\s*Number\s*:", cl, re.I):
                    house_no = cl.split(":")[-1].strip()
            age_m = re.search(r"Age\s*[:\-]?\s*(\d+)", text, re.I)
            if age_m:
                try:
                    age = int(age_m.group(1))
                except (ValueError, IndexError):
                    pass
            if re.search(r"\bMale\b", text, re.I):
                gender = "Male"
            elif re.search(r"\bFemale\b", text, re.I):
                gender = "Female"
            elif re.search(r"Third\s*Gender", text, re.I):
                gender = "Third Gender"
            house_no = clean_house_number(house_no)
            name = clean_ocr_field(name)
            rel_name = clean_ocr_field(rel_name)
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


def _run_ocr_pdf_to_records(content: bytes) -> list:
    """Run fast OCR on PDF bytes (low DPI + resize + parallel pages). Returns list of record dicts for CSV."""
    if not content or convert_from_bytes is None or pytesseract is None:
        return []
    images = convert_from_bytes(content, dpi=OCR_DPI)
    all_records = []
    pages_to_process = []
    for page_idx, page in enumerate(images):
        if page_idx < 1:
            continue
        width, height = page.size
        top_margin = int(height * 0.06)
        bottom_margin = int(height * 0.04)
        content_box = (0, top_margin, width, height - bottom_margin)
        cropped_page = page.crop(content_box)
        pages_to_process.append(cropped_page)
    if not pages_to_process:
        return []
    def process_one_page(cropped_page):
        page_records = _extract_page_to_records(cropped_page, 3, 10)
        if len(page_records) < 15:
            alt = _extract_page_to_records(cropped_page, 2, 15)
            if len(alt) > len(page_records):
                return alt
        return page_records
    with ThreadPoolExecutor(max_workers=min(OCR_PAGE_WORKERS, len(pages_to_process))) as executor:
        futures = [executor.submit(process_one_page, p) for p in pages_to_process]
        for fut in as_completed(futures):
            try:
                all_records.extend(fut.result())
            except Exception as e:
                logger.warning("OCR page failed: %s", e)
    seen = {r["Voter ID (EPIC)"]: r for r in all_records}
    return sorted(seen.values(), key=lambda x: (x.get("Card No") or 0, x["Voter ID (EPIC)"]))

@router.post("/convert-scanned-pdf")
async def convert_scanned_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF allowed")
    try:
        content = await file.read()
        sorted_records = _run_ocr_pdf_to_records(content)
        output = io.StringIO()
        fieldnames = ["Card No", "Voter ID (EPIC)", "Name", "Relation", "Relative Name", "House Number", "Age", "Gender"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sorted_records)
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
        fieldnames = ["Card No", "Voter ID (EPIC)", "Name", "Relation", "Relative Name", "House Number", "Age", "Gender", "Booth Number", "Constituency Name"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in records:
            writer.writerow({
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


# ------------------ BATCH CONVERT (for ~1000 PDFs) ------------------

@router.post("/batch-convert-electoral-pdf")
async def batch_convert_electoral_pdf(files: list[UploadFile] = File(...)):
    """
    Convert multiple scanned electoral roll PDFs to CSV and return a single ZIP.
    Max BATCH_MAX_FILES per request; use multiple requests for 1000+ PDFs.
    Uses fast OCR (150 DPI, resize, parallel pages) and BATCH_PDF_WORKERS for parallel PDFs.
    """
    pdfs = [f for f in files if f.filename and f.filename.lower().endswith(".pdf")]
    if len(pdfs) > BATCH_MAX_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {BATCH_MAX_FILES} PDFs per request. Send multiple requests for more.",
        )
    if not pdfs:
        raise HTTPException(status_code=400, detail="No PDF files provided")

    contents = await asyncio.gather(*[f.read() for f in pdfs])
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor(max_workers=BATCH_PDF_WORKERS) as executor:
        record_lists = await asyncio.gather(
            *[loop.run_in_executor(executor, _run_ocr_pdf_to_records, c) for c in contents],
            return_exceptions=True,
        )

    zip_buf = io.BytesIO()
    fieldnames = ["Card No", "Voter ID (EPIC)", "Name", "Relation", "Relative Name", "House Number", "Age", "Gender"]
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename, item in zip([f.filename or "unknown.pdf" for f in pdfs], record_lists):
            if isinstance(item, BaseException):
                logger.warning("Batch item %s failed: %s", filename, item)
                continue
            records = item
            base = os.path.splitext(filename)[0]
            csv_name = f"{base}.csv"
            output = io.StringIO()
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)
            zf.writestr(csv_name, output.getvalue().encode("utf-8-sig"))
    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="electoral_rolls_batch.zip"'},
    )