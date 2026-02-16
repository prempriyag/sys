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

OCR_DPI = 200
OCR_SCALE = 1.0
OCR_PAGE_WORKERS = 4

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


# ------------------ OCR HELPERS ------------------

def clean_ocr_field(value: str) -> str:
    if not value or not isinstance(value, str):
        return ""
    value = value.strip().upper()
    value = re.sub(r"[^\w\s\-]", "", value, flags=re.IGNORECASE)
    return " ".join(value.split())


def clean_house_number(value: str) -> str:
    if not value or not isinstance(value, str):
        return ""
    value = value.strip()
    value = re.sub(r"\s*Photo\s*(?:Available|Not|Submitted)?\s*$", "", value, flags=re.IGNORECASE)
    value = re.sub(r"^\s*Photo\s*(?:Available|Not|Submitted)?\s*", "", value, flags=re.IGNORECASE)
    return value.strip()


def _extract_page(cropped_page, ncol, nrow):
    """Extract voter records from one page; no whitelist, permissive EPIC."""
    c_width, c_height = cropped_page.size
    box_w, box_h = c_width // ncol, c_height // nrow
    out = []
    epic_re = re.compile(r"\b([A-Za-z]{2,5}\d{5,10})\b", re.IGNORECASE)
    for r in range(nrow):
        for c in range(ncol):
            box = cropped_page.crop((c * box_w, r * box_h, c * box_w + box_w, r * box_h + box_h))
            text = pytesseract.image_to_string(box, config="--oem 3 --psm 6")
            if not text.strip():
                continue
            m = epic_re.search(text)
            if not m:
                continue
            raw = m.group(1).upper().replace("/", "")
            epic = raw.replace("O", "0").replace("I", "1").replace("Z", "2")
            if not re.match(r"^[A-Z]{3}\d{7}$", epic):
                epic = re.sub(r"[^A-Z0-9]", "", epic)
            if len(epic) < 5:
                continue
            lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
            name = rel_name = rel_role = house_no = ""
            age = None
            gender = ""
            for i, line in enumerate(lines):
                if re.search(r"^Name\s*[:\-]", line, re.I) and not name:
                    part = line.split(":", 1)[-1].split("-", 1)[-1].strip()
                    name = part or (lines[i + 1].strip() if i + 1 < len(lines) else "")
                elif re.search(r"(Father|Husband|Mother)(?:'s)?\s*Name\s*[:\-]", line, re.I):
                    rm = re.search(r"(Father|Husband|Mother)", line, re.I)
                    rel_role = rm.group(1) if rm else "Other"
                    part = line.split(":", 1)[-1].split("-", 1)[-1].strip()
                    rel_name = part or (lines[i + 1].strip() if i + 1 < len(lines) else "")
                elif re.search(r"House\s*Number\s*[:\-]", line, re.I):
                    part = line.split(":", 1)[-1].split("-", 1)[-1].strip()
                    house_no = part or (lines[i + 1].strip() if i + 1 < len(lines) else "")
            am = re.search(r"Age\s*[:\-]?\s*(\d+)", text, re.I)
            if am:
                try:
                    age = int(am.group(1))
                except (ValueError, IndexError):
                    pass
            if re.search(r"\bMale\b", text, re.I):
                gender = "Male"
            elif re.search(r"\bFemale\b", text, re.I):
                gender = "Female"
            house_no = clean_house_number(house_no)
            name = clean_ocr_field(name)
            rel_name = clean_ocr_field(rel_name)
            card_no = None
            cn = re.search(r"^\s*(\d+)\b", text) or re.search(r"\b(\d{2,5})\b", text)
            if cn:
                try:
                    card_no = int(cn.group(1))
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


def _run_ocr_pdf_to_records(content: bytes) -> list:
    if not content or convert_from_bytes is None or pytesseract is None:
        return []
    images = convert_from_bytes(content, dpi=OCR_DPI)
    records = []
    for page_idx, page in enumerate(images):
        if page_idx < 1:
            continue
        w, h = page.size
        top = int(h * 0.06)
        bottom = int(h * 0.04)
        cropped = page.crop((0, top, w, h - bottom))
        page_records = _extract_page(cropped, 3, 10)
        if len(page_records) < 15:
            alt = _extract_page(cropped, 2, 15)
            if len(alt) > len(page_records):
                page_records = alt
        records.extend(page_records)
    seen = {}
    for r in records:
        e = r["Voter ID (EPIC)"]
        if e not in seen:
            seen[e] = r
    return sorted(seen.values(), key=lambda x: (x.get("Card No") or 0, x["Voter ID (EPIC)"]))


@router.post("/convert-scanned-pdf")
async def convert_scanned_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF allowed")
    try:
        content = await file.read()
        ordered = _run_ocr_pdf_to_records(content)
        output = io.StringIO()
        fieldnames = ["Serial No", "Card No", "Voter ID (EPIC)", "Name", "Relation", "Relative Name", "House Number", "Age", "Gender"]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for serial, r in enumerate(ordered, start=1):
            writer.writerow({"Serial No": serial, **r})
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8-sig")),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=voter_list.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR Processing Error: {str(e)}")


# ------------------ SOP: PARSE ELECTORAL ROLL PDF ------------------

@router.post("/parse-electoral-roll-pdf")
async def parse_electoral_roll_pdf_endpoint(
    file: UploadFile = File(...),
    constituency_name: str = Form(""),
    booth_number: str = Form(""),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files allowed")

    content = await file.read()
    const_name = constituency_name.strip() or None
    booth_no = booth_number.strip() or None

    records, parsed_const, parsed_booth = parse_electoral_roll_pdf(
        content,
        default_constituency_name=const_name,
        default_booth_number=booth_no,
        default_part_number=booth_no,
    )

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
