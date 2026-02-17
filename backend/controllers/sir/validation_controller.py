"""Field validation: sampling list with status, update verification status."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from models.sir.match_result import MatchResult
from models.sir.field_validation import FieldValidationResult
from models.sir.voter import VoterPre, VoterPost
from models.sir.booth import Booth
from sqlalchemy import func
from pydantic import BaseModel

router = APIRouter(prefix="/api/sir/validation", tags=["SIR Field Validation"])


class UpdateValidationStatusBody(BaseModel):
    match_result_id: int
    status: str  # VERIFIED_CORRECT | FALSE_DELETION | SUSPICIOUS_ADDITION
    notes: str | None = None


@router.get("/sampling-with-status/{constituency_id}")
def get_sampling_with_status(
    constituency_id: int,
    sample_percent: float = Query(5.0, ge=0.1, le=100.0),
    classification: str = Query(None, description="Filter by DELETED or ADDED"),
    db: Session = Depends(get_db),
):
    """
    Get validation sample (deleted or added voters) with current field verification status.
    For DELETED: returns pre_voter details. For ADDED: returns post_voter details.
    """
    booths = db.query(Booth.id).filter(Booth.constituency_id == constituency_id).all()
    booth_ids = [b.id for b in booths]
    if not booth_ids:
        return []

    # DELETED sample (default)
    if classification != "ADDED":
        deleted_query = (
            db.query(MatchResult, VoterPre, FieldValidationResult.status.label("validation_status"))
            .join(VoterPre, MatchResult.pre_voter_id == VoterPre.id)
            .outerjoin(FieldValidationResult, FieldValidationResult.match_result_id == MatchResult.id)
            .filter(VoterPre.booth_id.in_(booth_ids), MatchResult.classification == "DELETED")
        )
        total_deleted = deleted_query.count()
        sample_size = max(1, int(total_deleted * sample_percent / 100))
        rows = deleted_query.order_by(func.random()).limit(sample_size).all()
        result = []
        for mr, pre, val_status in rows:
            result.append({
                "match_result_id": mr.id,
                "classification": "DELETED",
                "epic_number": pre.epic_number,
                "name": pre.name,
                "relative_name": pre.relative_name,
                "age": pre.age,
                "gender": pre.gender,
                "house_no": pre.house_no,
                "booth_id": pre.booth_id,
                "validation_status": val_status,
            })
        return result

    # ADDED sample
    added_query = (
        db.query(MatchResult, VoterPost, FieldValidationResult.status.label("validation_status"))
        .join(VoterPost, MatchResult.post_voter_id == VoterPost.id)
        .outerjoin(FieldValidationResult, FieldValidationResult.match_result_id == MatchResult.id)
        .filter(VoterPost.booth_id.in_(booth_ids), MatchResult.classification == "ADDED")
    )
    total_added = added_query.count()
    sample_size = max(1, int(total_added * sample_percent / 100))
    rows = added_query.order_by(func.random()).limit(sample_size).all()
    result = []
    for mr, post, val_status in rows:
        result.append({
            "match_result_id": mr.id,
            "classification": "ADDED",
            "epic_number": post.epic_number,
            "name": post.name,
            "relative_name": post.relative_name,
            "age": post.age,
            "gender": post.gender,
            "house_no": post.house_no,
            "booth_id": post.booth_id,
            "validation_status": val_status,
        })
    return result


@router.post("/update-status")
def update_validation_status(body: UpdateValidationStatusBody, db: Session = Depends(get_db)):
    """Set field verification status for a match result: VERIFIED_CORRECT, FALSE_DELETION, SUSPICIOUS_ADDITION."""
    allowed = {"VERIFIED_CORRECT", "FALSE_DELETION", "SUSPICIOUS_ADDITION"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"status must be one of {allowed}")
    mr = db.query(MatchResult).filter(MatchResult.id == body.match_result_id).first()
    if not mr:
        raise HTTPException(status_code=404, detail="Match result not found")
    rec = db.query(FieldValidationResult).filter(
        FieldValidationResult.match_result_id == body.match_result_id
    ).first()
    if not rec:
        rec = FieldValidationResult(match_result_id=body.match_result_id, status=body.status, notes=body.notes)
        db.add(rec)
    else:
        rec.status = body.status
        rec.notes = body.notes
    db.commit()
    db.refresh(rec)
    return {"message": "Status updated", "id": rec.id, "status": rec.status}
