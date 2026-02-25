from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form, Body
from fastapi.responses import Response
from pydantic import BaseModel
from pathlib import Path
from typing import Optional as Opt
import json
from sqlalchemy.orm import Session
from database.connection import get_db
from config.settings import settings
from models.sir.voter import VoterPre, VoterPost
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from models.sir.state import State
from models.sir.district import District
from models.sir.assembly_constituency import AssemblyConstituency
from models.sir.eci_roll_selection import EciRollSelection
from services.normalization import NormalizationService
from services.electoral_roll_pdf_extractor import extract_from_pdf, debug_pdf, get_pdf_page_texts
import pandas as pd
import io
import tempfile
import os
import logging

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


def _records_to_voters_pre(db: Session, records: list, batch_size: int = 1000):
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


def _records_to_voters_post(db: Session, records: list, batch_size: int = 1000):
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
    extraction_config: Opt[dict] = None


@router.post("/extract-pdf-by-path")
async def extract_pdf_by_path(body: ExtractByPathRequest = Body(...)):
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
            extraction_config=body.extraction_config,
        )
        mode = "ocr" if body.use_ocr else "text"
        result["accuracy_summary"] = _compute_accuracy_summary(
            result.get("records") or [], mode, result.get("metadata", {}).get("validation_stats")
        )
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
    extraction_config_json: str = Form(None),
):
    """
    Extract voter records from an ECI-style electoral roll PDF without saving to database.
    When the PDF has no text (image-only), OCR runs automatically. Set use_ocr=true to force OCR.
    extraction_config_json: Optional JSON for coordinate tuning, e.g. {"cards_per_row":9,"header_top":120,"data_bottom":750}
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
                extraction_config=extraction_config,
            )
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
        mode = "ocr" if use_ocr.lower() in ("true", "1", "yes") else "text"
        result["accuracy_summary"] = _compute_accuracy_summary(
            result.get("records") or [], mode, result.get("metadata", {}).get("validation_stats")
        )
        return result
    except ImportError as e:
        raise HTTPException(status_code=500, detail="PDF extraction requires pdfplumber. Install with: pip install pdfplumber")
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

    # Save PDF to persistent path and store pdf_path in eci_roll_selections
    base_dir = Path(__file__).resolve().parent.parent.parent / "download"
    folder = (
        base_dir
        / _safe_folder_name(state)
        / _safe_folder_name(revyear)
        / _safe_folder_name(district)
        / _safe_folder_name(ac_name)
    )
    folder.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    pdf_filename = f"eci_electoral_roll_{ts}.pdf"
    pdf_file_path = folder / pdf_filename
    try:
        pdf_file_path.write_bytes(pdf_bytes)
    except Exception as e:
        logger.warning("Could not save ECI PDF to %s: %s", pdf_file_path, e)
    else:
        saved_path_str = str(pdf_file_path.resolve())
        try:
            row = EciRollSelection(
                state=state.strip(),
                year_of_revision=(revyear or "").strip(),
                district=district.strip(),
                assembly_constituency=ac_name.strip(),
                language=(language or "English").strip(),
                created_by=None,
                pdf_path=saved_path_str,
            )
            db.add(row)
            db.commit()
        except Exception as e:
            logger.warning("Could not insert eci_roll_selections row: %s", e)
            db.rollback()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=eci_electoral_roll.pdf"},
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
        raise HTTPException(status_code=500, detail="PDF extraction requires pdfplumber. Install with: pip install pdfplumber")
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
        raise HTTPException(status_code=500, detail="PDF extraction requires pdfplumber. Install with: pip install pdfplumber")
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
