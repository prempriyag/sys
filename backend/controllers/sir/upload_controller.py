from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.voter import VoterPre, VoterPost
from models.sir.constituency import Constituency
from models.sir.booth import Booth
from services.normalization import NormalizationService
import pandas as pd
import io
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
