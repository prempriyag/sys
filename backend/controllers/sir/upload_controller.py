from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, Body
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from pathlib import Path
from typing import List, Optional as Opt
import json
from sqlalchemy.orm import Session
from sqlalchemy import func, case, inspect
from database.connection import get_db, SessionLocal
from config.settings import settings
from models.sir.voter import VoterPre, VoterPost
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from models.sir.state import State
from models.sir.district import District
from models.sir.assembly_constituency import AssemblyConstituency
from models.sir.eci_roll_selection import EciRollSelection
from models.sir.eci_download import EciDownload, EciDownloadFile
from models.sir.bulk_voter_import import BulkVoterImport
from services.normalization import NormalizationService
from services.electoral_roll_pdf_extractor import extract_from_pdf, debug_pdf, get_pdf_page_texts
import pandas as pd
import io
import tempfile
import os
import re
import logging
import queue
import threading
import asyncio

# OCR for convert-scanned-pdf (optional)
try:
    from pdf2image import convert_from_bytes
    import pytesseract
except ImportError:
    convert_from_bytes = None
    pytesseract = None
OCR_DPI = 400

logger = logging.getLogger(__name__)

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


def _records_to_voters_pre(db: Session, records: list, batch_size: int = 100):
    """Insert extracted records into voters_pre_sir. Returns count inserted."""
    inserted = 0
    voters = []
    for r in records:
        try:
            constituency = get_or_create_constituency(db, (r.get("constituency_name") or "").strip())
            booth = get_or_create_booth(
                db, constituency.id,
                (r.get("booth_number") or "").strip(),
                (r.get("location_name") or "").strip()
            )
            name = (r.get("name") or "").strip()
            relative_name = (r.get("relative_name") or "").strip()
            address = (r.get("address") or "").strip()
            normalized_name = NormalizationService.normalize_name(name)
            normalized_address = NormalizationService.normalize_text(address)
            voter = VoterPre(
                epic_number=(r.get("epic_number") or "").strip() or None,
                name=name,
                relative_name=relative_name,
                age=r.get("age"),
                gender=(r.get("gender") or "").strip().upper() or None,
                house_no=(r.get("house_no") or "").strip() or None,
                address=address,
                normalized_name=normalized_name,
                normalized_address=normalized_address,
                booth_id=booth.id,
            )
            voters.append(voter)
            inserted += 1
            if len(voters) >= batch_size:
                db.bulk_save_objects(voters)
                db.commit()
                voters = []
        except Exception as e:
            logger.error(f"Error processing record: {e}")
            continue
    if voters:
        db.bulk_save_objects(voters)
        db.commit()
    return inserted


def _records_to_voters_post(db: Session, records: list, batch_size: int = 100):
    """Insert extracted records into voters_post_sir. Returns count inserted."""
    inserted = 0
    voters = []
    for r in records:
        try:
            constituency = get_or_create_constituency(db, (r.get("constituency_name") or "").strip())
            booth = get_or_create_booth(
                db, constituency.id,
                (r.get("booth_number") or "").strip(),
                (r.get("location_name") or "").strip()
            )
            name = (r.get("name") or "").strip()
            relative_name = (r.get("relative_name") or "").strip()
            address = (r.get("address") or "").strip()
            normalized_name = NormalizationService.normalize_name(name)
            normalized_address = NormalizationService.normalize_text(address)
            voter = VoterPost(
                epic_number=(r.get("epic_number") or "").strip() or None,
                name=name,
                relative_name=relative_name,
                age=r.get("age"),
                gender=(r.get("gender") or "").strip().upper() or None,
                house_no=(r.get("house_no") or "").strip() or None,
                address=address,
                normalized_name=normalized_name,
                normalized_address=normalized_address,
                booth_id=booth.id,
            )
            voters.append(voter)
            inserted += 1
            if len(voters) >= batch_size:
                db.bulk_save_objects(voters)
                db.commit()
                voters = []
        except Exception as e:
            logger.error(f"Error processing record: {e}")
            continue
    if voters:
        db.bulk_save_objects(voters)
        db.commit()
    return inserted


def _records_to_voter_data(
    db: Session,
    records: list,
    pdf_name: str,
    default_constituency_name: Opt[str] = None,
    default_year: Opt[str] = None,
    batch_size: int = 100,
) -> dict:
    """
    Insert extracted records into voter_data with conflict-safe behavior.
    Uses (pdf_name, box_id) unique key and skips duplicates.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    if not records:
        return {"inserted": 0, "duplicates_skipped": 0, "attempted": 0}

    inspector = inspect(db.bind)
    table_cols = {c.get("name") for c in inspector.get_columns("voter_data")}
    unique_sets = {frozenset(u.get("column_names") or []) for u in inspector.get_unique_constraints("voter_data")}
    conflict_cols = None
    if {"pdf_name", "box_id"}.issubset(table_cols) and frozenset(("pdf_name", "box_id")) in unique_sets:
        conflict_cols = ["pdf_name", "box_id"]
    elif "epic_number" in table_cols and frozenset(("epic_number",)) in unique_sets:
        conflict_cols = ["epic_number"]

    rows = []
    safe_pdf_name = (pdf_name or "uploaded.pdf")[:255]
    for idx, r in enumerate(records, start=1):
        conf = r.get("confidence_score")
        if conf is None:
            conf = r.get("confidence")
        try:
            conf = float(conf) if conf is not None else None
        except (TypeError, ValueError):
            conf = None

        row = {
            "page_number": r.get("page_number"),
            "epic_number": ((r.get("epic_number") or "").strip() or None),
            "name": ((r.get("name") or "").strip()[:255] or None),
            "relative_name": ((r.get("relative_name") or "").strip()[:255] or None),
            "age": r.get("age"),
            "gender": ((r.get("gender") or "").strip()[:10] or None),
            "house_no": ((r.get("house_no") or "").strip()[:200] or None),
            "address": ((r.get("address") or "").strip() or None),
            "constituency_name": (
                ((default_constituency_name or "").strip() or (r.get("constituency_name") or "").strip())[:200] or None
            ),
            "year": (((default_year or "").strip() or (r.get("year") or "").strip())[:20] or None),
            "booth_number": ((r.get("booth_number") or "").strip()[:50] or None),
            "source_pdf": (safe_pdf_name[:500] or None),
            "confidence": conf,
        }
        if "pdf_name" in table_cols:
            row["pdf_name"] = safe_pdf_name
        if "box_id" in table_cols:
            row["box_id"] = idx
        if "relation_type" in table_cols:
            row["relation_type"] = ((r.get("relation_type") or r.get("relation") or "").strip()[:20] or None)
        if "confidence_score" in table_cols:
            row["confidence_score"] = conf
        rows.append({k: v for k, v in row.items() if k in table_cols})

    inserted = 0
    attempted = 0
    for i in range(0, len(rows), max(1, batch_size)):
        batch = rows[i : i + max(1, batch_size)]
        stmt = pg_insert(BulkVoterImport).values(batch)
        if conflict_cols:
            stmt = stmt.on_conflict_do_nothing(index_elements=conflict_cols)
        res = db.execute(stmt)
        db.commit()
        attempted += len(batch)
        if res.rowcount is not None and res.rowcount >= 0:
            inserted += int(res.rowcount)

    return {
        "inserted": inserted,
        "duplicates_skipped": max(0, attempted - inserted),
        "attempted": attempted,
    }

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
        batch_size = 100

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
        batch_size = 100

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


def _parse_block_lines_to_record(lines: list) -> dict:
    """Parse one card block (list of text lines) into one record dict. Returns {} if no EPIC."""
    if not lines:
        return {}
    text = "\n".join(lines) if isinstance(lines[0], str) else "\n".join(str(x) for x in lines)
    epic_re = re.compile(r"\b([A-Za-z]{2,5}\d{5,10})\b", re.IGNORECASE)
    m = epic_re.search(text)
    if not m:
        return {}
    raw = m.group(1).upper().replace("/", "")
    epic = raw.replace("O", "0").replace("I", "1").replace("Z", "2")
    if not re.match(r"^[A-Z]{3}\d{7}$", epic):
        epic = re.sub(r"[^A-Z0-9]", "", epic)
    if len(epic) < 5:
        return {}
    name = rel_name = rel_role = house_no = ""
    age = None
    gender = ""
    for i, line in enumerate(lines):
        line = (line.strip() if isinstance(line, str) else str(line)).strip()
        if not line:
            continue
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
    return {
        "Card No": card_no,
        "Voter ID (EPIC)": epic,
        "Name": name,
        "Relation": rel_role or "",
        "Relative Name": rel_name,
        "House Number": house_no,
        "Age": age,
        "Gender": gender,
    }


def _run_ocr_pdf_to_records(content: bytes) -> list:
    if not content or convert_from_bytes is None or pytesseract is None:
        return []
    images = convert_from_bytes(content, dpi=OCR_DPI)
    records = []
    # Import extractor page-level OCR so we can use EPIC-first → grid → contour → spatial fallback.
    from services.electoral_roll_pdf_extractor import (
        _ocr_page_epic_first,
        _ocr_page_grid,
        _ocr_page_contour_boxes,
        _ocr_page_spatial,
    )
    for page_idx, page in enumerate(images):
        # Skip only cover pages: no EPIC-like pattern in preview (do not hard-skip page 0).
        text_preview = pytesseract.image_to_string(page, config="--psm 6")
        if not re.search(r"[A-Za-z]{3}\d{6,7}", text_preview):
            continue
        w, h = page.size
        top = int(h * 0.06)
        bottom = int(h * 0.04)
        cropped = page.crop((0, top, w, h - bottom))
        page_number = page_idx + 1
        # Fallback chain: EPIC-first → grid → contour → spatial (never drop page).
        blocks, _, _ = _ocr_page_epic_first(cropped, num_cols=3, page_number=page_number)
        if not blocks or len(blocks) < 15:
            blocks = _ocr_page_grid(cropped, num_cols=3, rows_per_page=10, page_number=page_number)
        if not blocks or len(blocks) < 10:
            blocks = _ocr_page_contour_boxes(cropped, page_number=page_number)
        if not blocks:
            blocks = _ocr_page_spatial(cropped, num_cols=3)
        page_records = []
        for b in blocks:
            r = _parse_block_lines_to_record(b)
            if r.get("Voter ID (EPIC)"):
                page_records.append(r)
        logger.info("Page %d: extracted %d records", page_number, len(page_records))
        records.extend(page_records)
    # Dedup by (Card No, EPIC) so OCR variants of same EPIC don't drop records; rely on DB unique (pdf_name, box_id) for insert.
    seen = {}
    for r in records:
        key = (r.get("Card No"), r.get("Voter ID (EPIC)"))
        if key not in seen:
            seen[key] = r
    result = sorted(seen.values(), key=lambda x: (x.get("Card No") or 0, x.get("Voter ID (EPIC)", "")))
    logger.info("Total extracted: %d", len(result))
    return result


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
        logger.exception("Error uploading Post-SIR data")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


def _compute_accuracy_summary(records: list, extraction_mode: str = "text", validation_stats: dict = None) -> dict:
    """Compute accuracy estimate from extracted records. Includes structural metrics when validation_stats present."""
    if not records:
        return {"completeness_percent": 0, "estimated_accuracy": "N/A", "field_coverage": {}, "extraction_mode": extraction_mode}
    n = len(records)
    # Completeness: records with epic + name + (age or gender)
    complete = sum(1 for r in records if (r.get("epic_number") or "").strip() and (r.get("name") or "").strip() and ((r.get("age") is not None) or (r.get("gender") or "").strip()))
    completeness = round(100 * complete / n, 1) if n else 0
    # Field coverage
    def _has_val(r, k):
        v = r.get(k)
        return v is not None and (v != "" if isinstance(v, str) else True)
    field_coverage = {k: round(100 * sum(1 for r in records if _has_val(r, k)) / n, 1) for k in ["epic_number", "name", "relative_name", "age", "gender", "house_no", "address"]}
    # Estimated accuracy range (heuristic)
    base = 90 if extraction_mode == "text" else 75
    adj = min(10, completeness / 10)
    est_min = base - (100 - completeness) // 10
    est_max = min(98, base + adj)
    out = {
        "completeness_percent": completeness,
        "estimated_accuracy_range": f"{max(50, est_min)}–{est_max}%",
        "field_coverage": field_coverage,
        "extraction_mode": extraction_mode,
        "records_total": n,
        "records_complete": complete,
    }
    # Structural metrics from validation layer
    if validation_stats:
        out["epic_valid_pct"] = validation_stats.get("epic_valid_pct", 0)
        out["age_valid_pct"] = validation_stats.get("age_valid_pct", 0)
        out["gender_valid_pct"] = validation_stats.get("gender_valid_pct", 0)
        out["duplicate_epic_count"] = validation_stats.get("duplicate_epic_count", 0)
        out["low_confidence_count"] = validation_stats.get("low_confidence_count", 0)
        out["multi_epic_warnings"] = validation_stats.get("multi_epic_warnings", 0)
        out["possible_cross_card_merge_count"] = validation_stats.get("possible_cross_card_merge_count", 0)
        avg_conf = sum(r.get("confidence_score", 0) for r in records) / n if n else 0
        out["avg_confidence_score"] = round(avg_conf * 100, 1)
    return out


def _get_pdf_folder() -> Path:
    """Return backend/pdf folder path. Create if missing."""
    folder = Path(__file__).resolve().parent.parent.parent / "pdf"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


@router.get("/pdf-file")
async def serve_pdf_file(filename: str):
    """
    Serve a PDF file from backend/pdf folder for preview (e.g. in ABBYY-like zone editor).
    """
    folder = _get_pdf_folder()
    try:
        path = (folder / filename).resolve()
        path.relative_to(folder.resolve())
    except (ValueError, OSError):
        raise HTTPException(status_code=404, detail="PDF not found")
    if not path.exists() or path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail="PDF not found")
    from fastapi.responses import FileResponse
    return FileResponse(path, media_type="application/pdf", filename=filename)


@router.get("/pdf-files")
async def list_pdf_files():
    """
    List PDF files in backend/pdf folder. Copy your PDF there, then select from dropdown.
    """
    folder = _get_pdf_folder()
    files = sorted(f.name for f in folder.iterdir() if f.suffix.lower() == ".pdf")
    return {"files": files, "folder": str(folder)}


class ExtractByPathRequest(BaseModel):
    filename: str
    constituency_name: Opt[str] = None
    booth_number: Opt[str] = None
    use_ocr: bool = False
    use_textract: bool = False
    extraction_config: Opt[dict] = None
    save_to_db: bool = False
    year: Opt[str] = None


@router.post("/extract-pdf-by-path")
async def extract_pdf_by_path(body: ExtractByPathRequest = Body(...), db: Session = Depends(get_db)):
    """
    Extract from a PDF in backend/pdf folder (select filename from dropdown).
    Supports extraction_config for ABBYY-like coordinate tuning:
    { cards_per_row: 9, header_top: 120, data_bottom: 750, margin_left: 20, margin_right: 20 }
    """
    folder = _get_pdf_folder()
    path = folder / body.filename
    if not path.exists() or path.suffix.lower() != ".pdf":
        raise HTTPException(status_code=404, detail=f"PDF not found: {body.filename}")
    try:
        result = extract_from_pdf(
            path,
            default_constituency_name=body.constituency_name,
            default_booth_number=body.booth_number,
            use_ocr=body.use_ocr,
            use_textract=body.use_textract,
            extraction_config=body.extraction_config,
        )
        mode = "textract" if body.use_textract else ("ocr" if body.use_ocr else "text")
        result["accuracy_summary"] = _compute_accuracy_summary(
            result.get("records") or [], mode, result.get("metadata", {}).get("validation_stats")
        )
        if body.save_to_db:
            stats = _records_to_voter_data(
                db=db,
                records=result.get("records") or [],
                pdf_name=body.filename or "selected.pdf",
                default_constituency_name=body.constituency_name,
                default_year=body.year,
                batch_size=100,
            )
            result["db_save"] = {"enabled": True, **stats}
        else:
            result["db_save"] = {"enabled": False, "inserted": 0, "duplicates_skipped": 0, "attempted": 0}
        return result
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber required. pip install pdfplumber")
    except Exception as e:
        logger.exception("Error extracting PDF by path")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-pdf")
async def extract_pdf_only(
    file: UploadFile = File(...),
    constituency_name: str = Form(None),
    booth_number: str = Form(None),
    use_ocr: str = Form("false"),
    use_textract: str = Form("false"),
    extraction_config_json: str = Form(None),
    save_to_db: str = Form("false"),
    year: str = Form(None),
    db: Session = Depends(get_db),
):
    """
    Extract voter records from an ECI-style electoral roll PDF.
    When the PDF has no text (image-only), OCR runs automatically. Set use_ocr=true to force OCR.
    use_textract: true to use AWS Textract (requires boto3, AWS_BUCKET, AWS credentials).
    extraction_config_json: Optional JSON for coordinate tuning, e.g. {"cards_per_row":9,"header_top":120,"data_bottom":750}
      Or {"engine":"textract"} to force Textract.
    save_to_db: true/false. When true, extracted rows are inserted into voter_data.
    Returns { "records": [...], "metadata": {...}, "raw_page_texts": [...] } for preview.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    extraction_config = None
    if extraction_config_json and extraction_config_json.strip():
        try:
            extraction_config = json.loads(extraction_config_json)
        except json.JSONDecodeError:
            pass
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            result = extract_from_pdf(
                tmp_path,
                default_constituency_name=constituency_name or None,
                default_booth_number=booth_number or None,
                use_ocr=use_ocr.lower() in ("true", "1", "yes"),
                use_textract=use_textract.lower() in ("true", "1", "yes"),
                extraction_config=extraction_config,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        mode = "textract" if use_textract.lower() in ("true", "1", "yes") else ("ocr" if use_ocr.lower() in ("true", "1", "yes") else "text")
        result["accuracy_summary"] = _compute_accuracy_summary(
            result.get("records") or [], mode, result.get("metadata", {}).get("validation_stats")
        )
        do_save = _parse_bool_form(save_to_db)
        if do_save:
            stats = _records_to_voter_data(
                db=db,
                records=result.get("records") or [],
                pdf_name=file.filename or "uploaded.pdf",
                default_constituency_name=constituency_name,
                default_year=year,
                batch_size=100,
            )
            result["db_save"] = {"enabled": True, **stats}
        else:
            result["db_save"] = {"enabled": False, "inserted": 0, "duplicates_skipped": 0, "attempted": 0}
        return result
    except ImportError as e:
        logger.exception("PDF extraction ImportError")
        raise HTTPException(status_code=500, detail=f"PDF extraction import failed: {e}. In venv run: pip install pdfplumber boto3")
    except Exception as e:
        logger.exception("Error extracting PDF")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


def _parse_bool_form(val) -> bool:
    if val is None:
        return True
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ("1", "true", "yes", "on")


# ------------------ ECI metadata (states / districts / AC) for dropdowns ------------------

@router.get("/eci-states")
def eci_states(db: Session = Depends(get_db)):
    """Return all state names for the State dropdown (full list from ECI data)."""
    from data.eci_states_districts import ECI_ALL_STATES
    return {"states": ECI_ALL_STATES}


@router.get("/eci-districts")
def eci_districts(state: str = "", db: Session = Depends(get_db)):
    """Return district names for the given state. Uses full static list when available (e.g. Tamil Nadu, Karnataka); else DB."""
    from sqlalchemy import func
    state = (state or "").strip()
    if not state:
        return {"districts": []}
    from data.eci_states_districts import get_districts_for_state, STATE_DISTRICTS
    # Prefer full list from static data if we have it for this state (so dropdown has all districts)
    state_key = next((k for k in STATE_DISTRICTS if k.lower() == state.lower()), None)
    if state_key is not None:
        districts = get_districts_for_state(state_key)
    else:
        rows = (
            db.query(District.name)
            .join(State, District.state_id == State.id)
            .filter(func.lower(State.name) == state.lower())
            .order_by(District.name)
            .all()
        )
        districts = [r[0] for r in rows if r[0]]
    return {"districts": districts}


@router.get("/eci-assembly-constituencies")
def eci_assembly_constituencies(state: str = "", district: str = "", db: Session = Depends(get_db)):
    """Return assembly constituency names for the given state and district. Merges static list + DB so no options are missing."""
    from sqlalchemy import func
    from data.eci_states_districts import get_assembly_constituencies
    state = (state or "").strip()
    district = (district or "").strip()
    if not state or not district:
        return {"assembly_constituencies": []}
    # Static data (STATE_DISTRICT_AC) – full list for known state+district
    acs_static = get_assembly_constituencies(state, district)
    acs_db: list = []
    try:
        # DB: assembly_constituencies for this state+district (in case some were added or static is incomplete)
        rows = (
            db.query(AssemblyConstituency.name)
            .join(District, AssemblyConstituency.district_id == District.id)
            .join(State, District.state_id == State.id)
            .filter(
                func.lower(State.name) == state.lower(),
                func.lower(District.name) == district.lower(),
            )
            .order_by(AssemblyConstituency.name)
            .all()
        )
        acs_db = [r[0] for r in rows if r[0]]
    except Exception as e:
        logger.warning("eci-assembly-constituencies: DB lookup failed for state=%r district=%r: %s", state, district, e)
    # Merge: static first (preserve order), then any from DB not already in static
    acs = list(acs_static)
    seen = {(a or "").strip().lower() for a in acs_static}
    for name in acs_db:
        n = (name or "").strip()
        if not n:
            continue
        key = n.lower()
        if key not in seen:
            seen.add(key)
            acs.append(n)
    return {"assembly_constituencies": acs}


def _safe_folder_name(s: str) -> str:
    """Sanitize string for use in download path (no path traversal or invalid chars)."""
    if not s:
        return "unknown"
    s = str(s).strip().replace("\\", "_").replace("/", "_").replace(":", "_")
    for c in '*?"<>|':
        s = s.replace(c, "_")
    return s[:200] or "unknown"


def _infer_meta_from_folder_path(folder_path: str) -> dict:
    """
    Infer state/year/district/constituency from a server folder path.
    Expected shape (or deeper): .../<state>/<year>/<district>/<constituency>
    """
    try:
        parts = [p for p in Path(folder_path).resolve().parts if p and p not in ("/", "\\")]
    except Exception:
        parts = [p for p in Path(folder_path).parts if p and p not in ("/", "\\")]
    if len(parts) >= 4:
        return {
            "state": parts[-4],
            "year": parts[-3],
            "district": parts[-2],
            "constituency_name": parts[-1],
        }
    if len(parts) == 3:
        return {
            "state": parts[-3],
            "year": parts[-2],
            "district": parts[-1],
        }
    return {}


def _resolve_extract_path_meta(
    state: Opt[str], year: Opt[str], district: Opt[str], constituency_name: Opt[str]
) -> tuple[str, str, str, Opt[str]]:
    """
    Always return usable extracted-path metadata.
    If missing, auto-fill with safe defaults so bulk flow never fails on metadata.
    """
    resolved_state = (state or "").strip() or "unknown_state"
    resolved_year = (year or "").strip() or "unknown_year"
    resolved_district = (district or "").strip() or "unknown_district"
    resolved_constituency = (constituency_name or "").strip() or None
    return resolved_state, resolved_year, resolved_district, resolved_constituency


@router.get("/eci-roll-selections")
def list_eci_roll_selections(db: Session = Depends(get_db), limit: int = 20):
    """List recent eci_roll_selections rows (to verify table and that download save works)."""
    rows = (
        db.query(EciRollSelection)
        .order_by(EciRollSelection.id.desc())
        .limit(max(1, min(limit, 100)))
        .all()
    )
    return {
        "count": len(rows),
        "rows": [
            {
                "id": r.id,
                "state": r.state,
                "year_of_revision": r.year_of_revision,
                "district": r.district,
                "assembly_constituency": r.assembly_constituency,
                "language": r.language,
                "pdf_path": r.pdf_path,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/bulk-electoral-roll-count")
def bulk_electoral_roll_count(db: Session = Depends(get_db)):
    """Return row count in voter_data so you can verify data is stored (PostgreSQL)."""
    try:
        count = db.query(BulkVoterImport).count()
        return {"count": count, "table": "voter_data"}
    except Exception as e:
        err = str(e).lower()
        if "does not exist" in err or "relation" in err:
            raise HTTPException(
                status_code=503,
                detail="Table voter_data missing. Run: python create_sir_tables.py or alembic upgrade head",
            ) from e
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/bulk-electoral-roll-data")
def bulk_electoral_roll_data(
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 100,
    q: Opt[str] = None,
    pdf_name: Opt[str] = None,
):
    """
    Paginated voter_data listing for UI.
    """
    page = max(1, page)
    page_size = max(1, min(page_size, 500))
    query = db.query(BulkVoterImport)
    if pdf_name and pdf_name.strip():
        query = query.filter(BulkVoterImport.pdf_name.ilike(f"%{pdf_name.strip()}%"))
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (BulkVoterImport.epic_number.ilike(term))
            | (BulkVoterImport.name.ilike(term))
            | (BulkVoterImport.relative_name.ilike(term))
            | (BulkVoterImport.constituency_name.ilike(term))
            | (BulkVoterImport.booth_number.ilike(term))
        )
    total = query.count()
    rows = (
        query.order_by(BulkVoterImport.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size if total else 0,
        "items": [
            {
                "id": r.id,
                "pdf_name": r.pdf_name,
                "page_number": r.page_number,
                "box_id": r.box_id,
                "epic_number": r.epic_number,
                "name": r.name,
                "relative_name": r.relative_name,
                "relation_type": r.relation_type,
                "age": r.age,
                "gender": r.gender,
                "house_no": r.house_no,
                "address": r.address,
                "constituency_name": r.constituency_name,
                "year": r.year,
                "booth_number": r.booth_number,
                "source_pdf": r.source_pdf,
                "confidence_score": float(r.confidence_score) if r.confidence_score is not None else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/voter-data-summary-by-constituency-year")
def voter_data_summary_by_constituency_year(db: Session = Depends(get_db)):
    """
    Summary of voter_data (Bulk Upload) grouped by constituency_name and year.
    For dashboard: constituency-based view with year comparison.
    """
    from sqlalchemy import func

    rows = (
        db.query(
            BulkVoterImport.constituency_name,
            BulkVoterImport.year,
            func.count(BulkVoterImport.id).label("record_count"),
            func.count(func.distinct(BulkVoterImport.pdf_name)).label("pdf_count"),
        )
        .filter(
            BulkVoterImport.constituency_name.isnot(None),
            BulkVoterImport.constituency_name != "",
        )
        .group_by(BulkVoterImport.constituency_name, BulkVoterImport.year)
        .order_by(BulkVoterImport.constituency_name, BulkVoterImport.year.desc().nullslast())
        .all()
    )
    by_constituency: dict = {}
    for r in rows:
        cn = (r.constituency_name or "").strip() or "unknown"
        yr = (r.year or "").strip() or "unknown"
        if cn not in by_constituency:
            by_constituency[cn] = []
        by_constituency[cn].append({
            "year": yr,
            "record_count": int(r.record_count or 0),
            "pdf_count": int(r.pdf_count or 0),
        })
    items = [
        {"constituency_name": cn, "years": yrs, "total_records": sum(y["record_count"] for y in yrs)}
        for cn, yrs in sorted(by_constituency.items())
    ]
    return {"items": items, "count": len(items)}


@router.get("/bulk-electoral-roll-quality")
def bulk_electoral_roll_quality(db: Session = Depends(get_db), limit: int = 500):
    """
    Per-PDF completeness/quality summary from voter_data.
    """
    limit = max(1, min(limit, 2000))
    rows = (
        db.query(
            BulkVoterImport.pdf_name.label("pdf_name"),
            func.count(BulkVoterImport.id).label("total"),
            func.sum(case((BulkVoterImport.epic_number.isnot(None), 1), else_=0)).label("epic_present"),
            func.sum(case((BulkVoterImport.name.isnot(None), 1), else_=0)).label("name_present"),
            func.sum(case((BulkVoterImport.age.isnot(None), 1), else_=0)).label("age_present"),
            func.sum(case((BulkVoterImport.gender.isnot(None), 1), else_=0)).label("gender_present"),
            func.sum(case((BulkVoterImport.house_no.isnot(None), 1), else_=0)).label("house_no_present"),
            func.sum(case((BulkVoterImport.address.isnot(None), 1), else_=0)).label("address_present"),
            func.avg(BulkVoterImport.confidence_score).label("avg_confidence"),
        )
        .group_by(BulkVoterImport.pdf_name)
        .order_by(func.count(BulkVoterImport.id).desc())
        .limit(limit)
        .all()
    )
    out = []
    for r in rows:
        total = int(r.total or 0)
        pct = lambda x: round((100.0 * float(x or 0) / total), 1) if total else 0.0
        out.append(
            {
                "pdf_name": r.pdf_name,
                "total_records": total,
                "epic_present_pct": pct(r.epic_present),
                "name_present_pct": pct(r.name_present),
                "age_present_pct": pct(r.age_present),
                "gender_present_pct": pct(r.gender_present),
                "house_no_present_pct": pct(r.house_no_present),
                "address_present_pct": pct(r.address_present),
                "avg_confidence_pct": round((float(r.avg_confidence or 0) * 100.0), 1),
            }
        )
    return {"count": len(out), "items": out}


@router.post("/bulk-electoral-roll")
async def bulk_electoral_roll(
    db: Session = Depends(get_db),
    folder_path: Opt[str] = Form(None),
    files: Opt[List[UploadFile]] = File(None),
    constituency_name: Opt[str] = Form(None),
    year: Opt[str] = Form(None),
    state: Opt[str] = Form(None),
    district: Opt[str] = Form(None),
):
    """
    Bulk Electoral Roll: folder path (production) or file uploads.
    - **Folder path**: Uses pdf_folder_extractor — extract_from_pdf (all pages), box_id per PDF, insert then move. Target: extracted/state/year/district/constituency/.
    - **Files**: Uses bulk_electoral_roll_engine — text/OCR, insert then move.
    """
    from database.connection import SessionLocal
    from services.bulk_electoral_roll_engine import run_bulk

    extracted_base = os.environ.get("EXTRACTED_FOLDER", "").strip()
    if not extracted_base:
        backend_dir = Path(__file__).resolve().parent.parent.parent
        extracted_base = str(backend_dir / "extracted")

    # Production path: server folder (e.g. download/Tamil_Nadu/2026/Erode/83_-_Gobichettipalayam)
    if folder_path and folder_path.strip() and (not files or len(files) == 0):
        folder = Path(folder_path.strip())
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail="folder_path is not a valid directory")
        inferred = _infer_meta_from_folder_path(folder_path.strip())
        eff_state = (state or "").strip() or inferred.get("state")
        eff_year = (year or "").strip() or inferred.get("year")
        eff_district = (district or "").strip() or inferred.get("district")
        eff_constituency = (constituency_name or "").strip() or inferred.get("constituency_name")
        eff_state, eff_year, eff_district, eff_constituency = _resolve_extract_path_meta(
            eff_state, eff_year, eff_district, eff_constituency
        )
        try:
            from services.pdf_folder_extractor import process_folder
            result = process_folder(
                folder_path.strip(),
                db,
                extracted_base,
                constituency_name=eff_constituency,
                state=eff_state,
                year=eff_year,
                district=eff_district,
                use_ocr=True,
            )
        except Exception as e:
            logger.exception("process_folder failed: %s", e)
            err_msg = str(e).strip()
            if "pdf_name" in err_msg or "box_id" in err_msg or "does not exist" in err_msg.lower():
                err_msg = (
                    "Table voter_data is missing columns. Run: cd backend && alembic upgrade head "
                    "or run scripts/sql/add_voter_data_pdf_box_columns.sql in PostgreSQL. Original: "
                ) + err_msg
            raise HTTPException(status_code=500, detail=err_msg)
        if result.get("errors") and result.get("total_inserted", 0) == 0:
            detail = "; ".join(result["errors"][:5])
            if "pdf_name" in detail or "box_id" in detail or "does not exist" in detail.lower():
                detail = "Table voter_data missing columns. Run: cd backend && alembic upgrade head (or run scripts/sql/add_voter_data_pdf_box_columns.sql). " + detail
            raise HTTPException(status_code=500, detail=detail)
        return result

    pdf_paths: List[str] = []
    temp_dir = None

    if files and len(files) > 0:
        eff_state, eff_year, eff_district, eff_constituency = _resolve_extract_path_meta(
            state, year, district, constituency_name
        )
        import tempfile
        temp_dir = tempfile.mkdtemp(prefix="bulk_roll_")
        for f in files:
            if f.filename and f.filename.lower().endswith(".pdf"):
                path = Path(temp_dir) / (f.filename or "upload.pdf")
                content = await f.read()
                path.write_bytes(content)
                pdf_paths.append(str(path))
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide folder_path (server path) or upload PDF files",
        )

    if not pdf_paths:
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        return {
            "total_found": 0,
            "inserted": 0,
            "duplicates_skipped": 0,
            "invalid_epic_count": 0,
            "invalid_epics": [],
            "message": "No PDF files found.",
        }

    try:
        result = run_bulk(
            pdf_paths,
            SessionLocal,
            max_workers=1,
            batch_size=500,
            constituency_name=eff_constituency,
            year=eff_year,
            extracted_base=extracted_base,
            state=eff_state,
            district=eff_district,
        )
    except Exception as e:
        logger.exception("bulk-electoral-roll failed: %s", e)
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        err_msg = str(e).strip()
        if "pdf_name" in err_msg or "box_id" in err_msg or "uq_voter_data_pdf_box" in err_msg:
            err_msg = "Table voter_data needs new columns. Run: cd backend && alembic upgrade head (or run scripts/sql/add_voter_data_pdf_box_columns.sql). " + err_msg
        elif "voter_data" in err_msg and ("does not exist" in err_msg or "relation" in err_msg.lower()):
            err_msg = "Table voter_data missing. Run: python create_sir_tables.py or alembic upgrade head"
        elif "bulk_voter_import" in err_msg and ("does not exist" in err_msg or "relation" in err_msg.lower()):
            err_msg = "Table voter_data missing (run migration to rename). Run: cd backend && alembic upgrade head"
        elif "year" in err_msg and ("column" in err_msg.lower() and "does not exist" in err_msg.lower()):
            err_msg = "Column 'year' missing on voter_data. Run: cd backend && alembic upgrade head"
        raise HTTPException(status_code=500, detail=err_msg)

    if temp_dir:
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

    return result


@router.post("/bulk-electoral-roll-stream")
async def bulk_electoral_roll_stream(
    folder_path: Opt[str] = Form(None),
    files: Opt[List[UploadFile]] = File(None),
    constituency_name: Opt[str] = Form(None),
    year: Opt[str] = Form(None),
    state: Opt[str] = Form(None),
    district: Opt[str] = Form(None),
):
    """
    Same as bulk-electoral-roll but returns Server-Sent Events: progress (current, total, pdf_name, records_so_far)
    then a final 'done' event with the result. Use for progress bar and live count.
    - folder_path only: production flow (process_folder → extract_from_pdf, insert, move) with progress.
    - files: run_bulk (text/OCR) with progress.
    """
    from database.connection import SessionLocal
    from services.bulk_electoral_roll_engine import run_bulk

    pdf_paths: List[str] = []
    temp_dir = None
    use_folder_flow = False  # True = process_folder (production), False = run_bulk
    effective_state = (state or "").strip() or None
    effective_year = (year or "").strip() or None
    effective_district = (district or "").strip() or None
    effective_constituency = (constituency_name or "").strip() or None

    if files and len(files) > 0:
        effective_state, effective_year, effective_district, effective_constituency = _resolve_extract_path_meta(
            effective_state, effective_year, effective_district, effective_constituency
        )
        temp_dir = tempfile.mkdtemp(prefix="bulk_roll_")
        for f in files:
            if f.filename and f.filename.lower().endswith(".pdf"):
                path = Path(temp_dir) / (f.filename or "upload.pdf")
                content = await f.read()
                path.write_bytes(content)
                pdf_paths.append(str(path))
    elif folder_path and folder_path.strip():
        folder = Path(folder_path.strip())
        if not folder.is_dir():
            raise HTTPException(status_code=400, detail="folder_path is not a valid directory")
        inferred = _infer_meta_from_folder_path(folder_path.strip())
        if not effective_state:
            effective_state = inferred.get("state")
        if not effective_year:
            effective_year = inferred.get("year")
        if not effective_district:
            effective_district = inferred.get("district")
        if not effective_constituency:
            effective_constituency = inferred.get("constituency_name")
        effective_state, effective_year, effective_district, effective_constituency = _resolve_extract_path_meta(
            effective_state, effective_year, effective_district, effective_constituency
        )
        pdf_paths = [str(p) for p in sorted(folder.glob("*.pdf"))]
        use_folder_flow = True
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide either folder_path or upload multiple PDF files",
        )

    if not pdf_paths:
        if temp_dir:
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
            except Exception:
                pass
        return {"total_found": 0, "inserted": 0, "pdf_count": 0, "message": "No PDF files found."}

    extracted_base = os.environ.get("EXTRACTED_FOLDER", "").strip()
    if not extracted_base:
        backend_dir = Path(__file__).resolve().parent.parent.parent
        extracted_base = str(backend_dir / "extracted")
    progress_queue: queue.Queue = queue.Queue()

    def run_with_progress():
        def on_progress(current: int, total: int, pdf_name: str, records_so_far: int):
            progress_queue.put({"type": "progress", "current": current, "total": total, "pdf_name": pdf_name, "records_so_far": records_so_far})
        try:
            if use_folder_flow:
                from services.pdf_folder_extractor import process_folder
                db = SessionLocal()
                try:
                    result = process_folder(
                        folder_path.strip(),
                        db,
                        extracted_base,
                        constituency_name=effective_constituency,
                        state=effective_state,
                        year=effective_year,
                        district=effective_district,
                        use_ocr=True,
                        progress_callback=on_progress,
                    )
                    progress_queue.put({"type": "done", "result": result})
                finally:
                    db.close()
            else:
                result = run_bulk(
                    pdf_paths,
                    SessionLocal,
                    max_workers=1,
                    batch_size=500,
                    constituency_name=effective_constituency,
                    year=effective_year,
                    extracted_base=extracted_base,
                    state=effective_state,
                    district=effective_district,
                    progress_callback=on_progress,
                )
                progress_queue.put({"type": "done", "result": result})
        except Exception as e:
            logger.exception("bulk-electoral-roll-stream failed: %s", e)
            progress_queue.put({"type": "error", "detail": str(e)})

    thread = threading.Thread(target=run_with_progress, daemon=True)
    thread.start()

    async def event_stream():
        try:
            while True:
                try:
                    item = await asyncio.get_event_loop().run_in_executor(None, lambda: progress_queue.get(timeout=1))
                except queue.Empty:
                    yield ": keepalive\n\n"
                    continue
                yield f"data: {json.dumps(item)}\n\n"
                if item.get("type") in ("done", "error"):
                    break
        except asyncio.CancelledError:
            logger.info("bulk-electoral-roll-stream client disconnected (request cancelled)")
            return
        finally:
            thread.join(timeout=2)
            if temp_dir:
                try:
                    import shutil
                    shutil.rmtree(temp_dir, ignore_errors=True)
                except Exception:
                    pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/eci-download")
async def eci_download_roll(
    db: Session = Depends(get_db),
    state: str = Form("Tamil Nadu"),
    revyear: str = Form("2026"),
    district: str = Form("Chennai"),
    ac_name: str = Form("11 - Dr.Radhakrishnan Nagar"),
    language: str = Form("English"),
    manual_captcha: str = Form("true"),
):
    """
    Automate ECI electoral roll PDF download: pre-fill state, revyear, district, AC, language.
    Saves PDF under backend/download/<state>/<year>/<district>/<AC>/ and stores record in eci_roll_selections (pdf_path).
    Default: manual captcha. Use manual_captcha=false for OCR.
    Requires: pip install playwright && playwright install chromium
    """
    try:
        import asyncio
        from datetime import datetime
        from services.eci_downloader import download_eci_roll_via_subprocess
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="ECI downloader not available. Install: pip install playwright && playwright install chromium",
        )
    use_manual = _parse_bool_form(manual_captcha)
    # In Python 3.12+, prefer the running loop inside async endpoints.
    loop = asyncio.get_running_loop()
    try:
        pdf_bytes, error_msg = await loop.run_in_executor(
            None,
            lambda: download_eci_roll_via_subprocess(
                state=state,
                revyear=revyear,
                district=district,
                ac_name=ac_name,
                language=(language or "English").strip(),
                manual_captcha=use_manual,
            ),
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"ECI download failed to start: {e!s}. Ensure Playwright is installed (pip install playwright && playwright install chromium) and the server has permission to launch the browser.",
        )
    if error_msg:
        # Strip PyTorch/EasyOCR noise and old "continuing" lines from subprocess stderr
        lines = [l for l in error_msg.splitlines() if l.strip()
            and "Using CPU" not in l
            and "pin_memory" not in l
            and "dataloader" not in l.lower()
            and "accelerator" not in l.lower()
            and "super().__init__" not in l
            and "may have failed, continuing" not in l]
        detail = "\n".join(lines).strip() or error_msg.strip()
        # Normalize generic "canceled" into a clear message (Playwright or client disconnect)
        if detail.lower() in ("canceled", "error: canceled", "cancelled", "error: cancelled"):
            detail = (
                "Download was canceled or the connection was closed. "
                "This can happen if the request took too long or the page was closed. "
                "Please try again and wait for the download to complete (it may take 2–5 minutes)."
            )
        raise HTTPException(status_code=502, detail=detail)
    if not pdf_bytes:
        raise HTTPException(status_code=502, detail="No PDF was downloaded from ECI portal")

    # Save PDF to persistent path and store record in eci_roll_selections
    base_dir = Path(__file__).resolve().parent.parent.parent / "download"
    folder = (
        base_dir
        / _safe_folder_name(state)
        / _safe_folder_name(revyear)
        / _safe_folder_name(district)
        / _safe_folder_name(ac_name)
    )
    folder.mkdir(parents=True, exist_ok=True)
    pdf_filename = "downloaded.pdf"
    pdf_file_path = folder / pdf_filename
    pdf_file_path.write_bytes(pdf_bytes)
    saved_path_str = str(pdf_file_path.resolve())

    # ---- On every download: save PDF details in DB (check existing → update, else insert) ----
    state_s = state.strip()
    year_s = revyear.strip()
    district_s = district.strip()
    ac_s = ac_name.strip()
    language_s = (language or "").strip() or "English"

    record_saved = False
    selection_id = None
    save_db = SessionLocal()
    try:
        # maintain existing eci_roll_selections behaviour for backward compatibility
        existing = (
            save_db.query(EciRollSelection)
            .filter(
                EciRollSelection.state == state_s,
                EciRollSelection.year_of_revision == year_s,
                EciRollSelection.district == district_s,
                EciRollSelection.assembly_constituency == ac_s,
            )
            .first()
        )
        if existing:
            existing.pdf_path = saved_path_str
            existing.language = language_s
            save_db.commit()
            record_saved = True
            selection_id = existing.id
            logger.info("ECI updated eci_roll_selections id=%s pdf_path=%s", existing.id, saved_path_str)
        else:
            new_row = EciRollSelection(
                state=state_s,
                year_of_revision=year_s,
                district=district_s,
                assembly_constituency=ac_s,
                language=language_s,
                pdf_path=saved_path_str,
                created_by="system",
            )
            save_db.add(new_row)
            save_db.commit()
            save_db.refresh(new_row)
            record_saved = True
            selection_id = new_row.id
            logger.info("ECI inserted eci_roll_selections id=%s pdf_path=%s", new_row.id, saved_path_str)

        # additionally record in download + files tables
        try:
            new_dl = EciDownload(
                state=state_s,
                year_of_revision=year_s,
                district=district_s,
                assembly_constituency=ac_s,
                language=language_s,
                created_by="system",
            )
            save_db.add(new_dl)
            save_db.commit()
            save_db.refresh(new_dl)

            # unique batch of 4-6 digits
            from random import randint

            def _generate_batch():
                for _ in range(20):
                    candidate = str(randint(1000, 999999))
                    if not save_db.query(EciDownloadFile).filter_by(batch=candidate).first():
                        return candidate
                # fallback to timestamp if something odd
                return str(int(time.time()))

            import time
            batch_code = _generate_batch()
            new_file = EciDownloadFile(
                download_id=new_dl.id,
                batch=batch_code,
                file_path=saved_path_str,
                status="pending",
            )
            save_db.add(new_file)
            save_db.commit()
        except Exception as exc:
            logger.exception("Could not save download/files record: %s", exc)
            save_db.rollback()
    except Exception as e:
        logger.exception("Could not save eci_roll_selections: %s", e)
        save_db.rollback()
    finally:
        save_db.close()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "attachment; filename=eci_electoral_roll.pdf",
            "X-ECI-Record-Saved": "true" if record_saved else "false",
            "X-ECI-Selection-Id": str(selection_id or ""),
            "Access-Control-Expose-Headers": "X-ECI-Record-Saved, X-ECI-Selection-Id, Content-Disposition",
        },
    )


@router.post("/debug-pdf")
async def debug_pdf_upload(file: UploadFile = File(...)):
    """
    Return raw extracted text and structure for first 5 pages (layout and default).
    Use when extract-pdf returns 0 records to see what the PDF actually yields.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    try:
        import pdfplumber
    except ImportError:
        raise HTTPException(status_code=500, detail="pdfplumber required. pip install pdfplumber")
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            debug_info = debug_pdf(tmp_path)
            # Full page texts (no truncation) using chars fallback when extract_text is empty
            debug_info["page_texts_full"] = get_pdf_page_texts(tmp_path, max_pages=20)
            return debug_info
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except Exception as e:
        logger.exception("Error debugging PDF")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pre-sir-pdf")
async def upload_pre_sir_pdf(
    file: UploadFile = File(...),
    constituency_name: str = Form(None),
    booth_number: str = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload Pre-SIR electoral roll as PDF (ECI format).
    Optionally provide constituency_name and booth_number if not present in PDF.
    Extracted data is standardized (SOP 3.2) and stored in the database.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            result = extract_from_pdf(
                tmp_path,
                default_constituency_name=constituency_name or None,
                default_booth_number=booth_number or None,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        records = result.get("records") or []
        metadata = result.get("metadata") or {}
        if not records:
            return {
                "message": "No voter records extracted from PDF. Check format (ECI table with EPIC, Name, Relative, Age, Gender, House No, Address).",
                "records_processed": 0,
                "metadata": metadata,
            }
        inserted = _records_to_voters_pre(db, records)
        return {
            "message": f"Successfully extracted and stored {inserted} Pre-SIR records from PDF",
            "records_processed": inserted,
            "records_extracted": len(records),
            "metadata": metadata,
        }
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction import failed: {e}. Ensure pdfplumber is installed in the same Python that runs uvicorn: pip install pdfplumber")
    except Exception as e:
        logger.exception("Error uploading Pre-SIR PDF")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.post("/post-sir-pdf")
async def upload_post_sir_pdf(
    file: UploadFile = File(...),
    constituency_name: str = Form(None),
    booth_number: str = Form(None),
    db: Session = Depends(get_db),
):
    """
    Upload Post-SIR electoral roll as PDF (ECI format).
    Optionally provide constituency_name and booth_number if not present in PDF.
    Extracted data is standardized (SOP 3.2) and stored in the database.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    try:
        content = await file.read()
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            result = extract_from_pdf(
                tmp_path,
                default_constituency_name=constituency_name or None,
                default_booth_number=booth_number or None,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        records = result.get("records") or []
        metadata = result.get("metadata") or {}
        if not records:
            return {
                "message": "No voter records extracted from PDF. Check format (ECI table with EPIC, Name, Relative, Age, Gender, House No, Address).",
                "records_processed": 0,
                "metadata": metadata,
            }
        inserted = _records_to_voters_post(db, records)
        return {
            "message": f"Successfully extracted and stored {inserted} Post-SIR records from PDF",
            "records_processed": inserted,
            "records_extracted": len(records),
            "metadata": metadata,
        }
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction import failed: {e}. Ensure pdfplumber is installed in the same Python that runs uvicorn: pip install pdfplumber")
    except Exception as e:
        logger.exception("Error uploading Post-SIR PDF")
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")


@router.post("/booth-mapping")
async def upload_booth_mapping(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload booth mapping file (CSV). Updates booth location and optional turnout.
    Columns: constituency_name, booth_number, location_name, latitude, longitude, turnout_percentage
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        required = ["constituency_name", "booth_number"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")
        updated = 0
        for _, row in df.iterrows():
            constituency = get_or_create_constituency(db, str(row["constituency_name"]).strip())
            booth = db.query(Booth).filter(
                Booth.constituency_id == constituency.id,
                Booth.booth_number == str(row["booth_number"]).strip()
            ).first()
            if not booth:
                booth = Booth(constituency_id=constituency.id, booth_number=str(row["booth_number"]).strip())
                db.add(booth)
                db.commit()
                db.refresh(booth)
            if "location_name" in df.columns and pd.notna(row.get("location_name")):
                booth.location_name = str(row["location_name"]).strip()
            if "latitude" in df.columns and pd.notna(row.get("latitude")):
                try:
                    booth.latitude = float(row["latitude"])
                except (ValueError, TypeError):
                    pass
            if "longitude" in df.columns and pd.notna(row.get("longitude")):
                try:
                    booth.longitude = float(row["longitude"])
                except (ValueError, TypeError):
                    pass
            if "turnout_percentage" in df.columns and pd.notna(row.get("turnout_percentage")):
                try:
                    booth.turnout_percentage = float(row["turnout_percentage"])
                except (ValueError, TypeError):
                    pass
            updated += 1
        db.commit()
        return {"message": f"Booth mapping updated for {updated} booths", "records_processed": updated}
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except Exception as e:
        logger.exception("Error uploading booth mapping")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/turnout-history")
async def upload_turnout_history(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload turnout history file (CSV). Updates turnout_percentage per booth.
    Columns: constituency_name, booth_number, turnout_percentage
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        required = ["constituency_name", "booth_number", "turnout_percentage"]
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing)}")
        updated = 0
        for _, row in df.iterrows():
            constituency = db.query(Constituency).filter(
                Constituency.name.ilike(str(row["constituency_name"]).strip())
            ).first()
            if not constituency:
                continue
            booth = db.query(Booth).filter(
                Booth.constituency_id == constituency.id,
                Booth.booth_number == str(row["booth_number"]).strip()
            ).first()
            if not booth:
                continue
            try:
                booth.turnout_percentage = float(row["turnout_percentage"])
                updated += 1
            except (ValueError, TypeError):
                pass
        db.commit()
        return {"message": f"Turnout updated for {updated} booths", "records_processed": updated}
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except Exception as e:
        logger.exception("Error uploading turnout history")
        raise HTTPException(status_code=500, detail=str(e))
