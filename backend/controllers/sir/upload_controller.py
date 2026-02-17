from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.voter import VoterPre, VoterPost
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from services.normalization import NormalizationService
from services.electoral_roll_pdf_extractor import extract_from_pdf
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

def get_or_create_constituency(db: Session, constituency_name: str, district: str = None, state: str = None):
    """Get or create a constituency"""
    constituency = db.query(Constituency).filter(Constituency.name.ilike(constituency_name)).first()
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
    """Get or create a booth"""
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
    """
    Upload Pre-SIR electoral roll CSV file.
    Expected columns: epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name
    """
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Validate required columns
        required_columns = ['epic_number', 'name', 'relative_name', 'age', 'gender', 'house_no', 'address', 'booth_number', 'constituency_name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        # Clear existing Pre-SIR data (optional - you might want to keep historical data)
        # db.query(VoterPre).delete()
        # db.commit()
        
        voters = []
        batch_size = 1000
        
        for idx, row in df.iterrows():
            try:
                # Get or create constituency
                constituency = get_or_create_constituency(
                    db, 
                    str(row['constituency_name']).strip()
                )
                
                # Get or create booth
                booth = get_or_create_booth(
                    db,
                    constituency.id,
                    str(row['booth_number']).strip(),
                    str(row.get('location_name', '')).strip()
                )
                
                # Normalize data
                name = str(row['name']).strip() if pd.notna(row['name']) else ""
                relative_name = str(row['relative_name']).strip() if pd.notna(row['relative_name']) else ""
                address = str(row['address']).strip() if pd.notna(row['address']) else ""
                
                normalized_name = NormalizationService.normalize_name(name)
                normalized_address = NormalizationService.normalize_text(address)
                
                # Create voter record
                voter = VoterPre(
                    epic_number=str(row['epic_number']).strip() if pd.notna(row['epic_number']) else None,
                    name=name,
                    relative_name=relative_name,
                    age=int(row['age']) if pd.notna(row['age']) else None,
                    gender=str(row['gender']).strip().upper() if pd.notna(row['gender']) else None,
                    house_no=str(row['house_no']).strip() if pd.notna(row['house_no']) else None,
                    address=address,
                    normalized_name=normalized_name,
                    normalized_address=normalized_address,
                    booth_id=booth.id
                )
                voters.append(voter)
                
                # Batch insert for performance
                if len(voters) >= batch_size:
                    db.bulk_save_objects(voters)
                    db.commit()
                    voters = []
                    
            except Exception as e:
                logger.error(f"Error processing row {idx}: {e}")
                continue
        
        # Insert remaining voters
        if voters:
            db.bulk_save_objects(voters)
            db.commit()
        
        return {
            "message": f"Successfully uploaded {len(df)} Pre-SIR records",
            "records_processed": len(df)
        }
        
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except Exception as e:
        logger.exception("Error uploading Pre-SIR data")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.post("/post-sir")
async def upload_post_sir(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload Post-SIR electoral roll CSV file.
    Expected columns: epic_number, name, relative_name, age, gender, house_no, address, booth_number, constituency_name
    """
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        # Validate required columns
        required_columns = ['epic_number', 'name', 'relative_name', 'age', 'gender', 'house_no', 'address', 'booth_number', 'constituency_name']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise HTTPException(
                status_code=400, 
                detail=f"Missing required columns: {', '.join(missing_columns)}"
            )
        
        voters = []
        batch_size = 1000
        
        for idx, row in df.iterrows():
            try:
                # Get or create constituency
                constituency = get_or_create_constituency(
                    db, 
                    str(row['constituency_name']).strip()
                )
                
                # Get or create booth
                booth = get_or_create_booth(
                    db,
                    constituency.id,
                    str(row['booth_number']).strip(),
                    str(row.get('location_name', '')).strip()
                )
                
                # Normalize data
                name = str(row['name']).strip() if pd.notna(row['name']) else ""
                relative_name = str(row['relative_name']).strip() if pd.notna(row['relative_name']) else ""
                address = str(row['address']).strip() if pd.notna(row['address']) else ""
                
                normalized_name = NormalizationService.normalize_name(name)
                normalized_address = NormalizationService.normalize_text(address)
                
                # Create voter record
                voter = VoterPost(
                    epic_number=str(row['epic_number']).strip() if pd.notna(row['epic_number']) else None,
                    name=name,
                    relative_name=relative_name,
                    age=int(row['age']) if pd.notna(row['age']) else None,
                    gender=str(row['gender']).strip().upper() if pd.notna(row['gender']) else None,
                    house_no=str(row['house_no']).strip() if pd.notna(row['house_no']) else None,
                    address=address,
                    normalized_name=normalized_name,
                    normalized_address=normalized_address,
                    booth_id=booth.id
                )
                voters.append(voter)
                
                # Batch insert for performance
                if len(voters) >= batch_size:
                    db.bulk_save_objects(voters)
                    db.commit()
                    voters = []
                    
            except Exception as e:
                logger.error(f"Error processing row {idx}: {e}")
                continue
        
        # Insert remaining voters
        if voters:
            db.bulk_save_objects(voters)
            db.commit()
        
        return {
            "message": f"Successfully uploaded {len(df)} Post-SIR records",
            "records_processed": len(df)
        }
        
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="CSV file is empty")
    except Exception as e:
        logger.exception("Error uploading Post-SIR data")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


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
