from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime, timedelta

from tradelog.database import get_db
from tradelog.models.journal import DailyJournal

router = APIRouter(prefix="/api/journal", tags=["journal"])


class JournalCreate(BaseModel):
    date: date
    mood: Optional[str] = None
    notes: Optional[str] = None
    mistakes: Optional[str] = None


class JournalUpdate(BaseModel):
    mood: Optional[str] = None
    notes: Optional[str] = None
    mistakes: Optional[str] = None


class JournalResponse(BaseModel):
    id: int
    date: date
    mood: Optional[str] = None
    notes: Optional[str] = None
    mistakes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/moods/summary")
def moods_summary(db: Session = Depends(get_db)):
    cutoff = date.today() - timedelta(days=30)
    rows = (
        db.query(DailyJournal.mood, func.count(DailyJournal.id))
        .filter(DailyJournal.date >= cutoff)
        .filter(DailyJournal.mood.isnot(None))
        .group_by(DailyJournal.mood)
        .all()
    )
    return {mood: count for mood, count in rows}


@router.get("/", response_model=List[JournalResponse])
def list_journals(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    q = db.query(DailyJournal)
    if date_from:
        q = q.filter(DailyJournal.date >= date_from)
    if date_to:
        q = q.filter(DailyJournal.date <= date_to)
    return q.order_by(DailyJournal.date.desc()).all()


@router.get("/{entry_date}", response_model=JournalResponse)
def get_journal_by_date(entry_date: str, db: Session = Depends(get_db)):
    try:
        d = date.fromisoformat(entry_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    entry = db.query(DailyJournal).filter(DailyJournal.date == d).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return entry


@router.post("/", response_model=JournalResponse, status_code=201)
def create_or_upsert_journal(payload: JournalCreate, db: Session = Depends(get_db)):
    existing = db.query(DailyJournal).filter(DailyJournal.date == payload.date).first()
    if existing:
        if payload.mood is not None:
            existing.mood = payload.mood
        if payload.notes is not None:
            existing.notes = payload.notes
        if payload.mistakes is not None:
            existing.mistakes = payload.mistakes
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing

    entry = DailyJournal(
        date=payload.date,
        mood=payload.mood,
        notes=payload.notes,
        mistakes=payload.mistakes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=JournalResponse)
def update_journal(entry_id: int, payload: JournalUpdate, db: Session = Depends(get_db)):
    entry = db.query(DailyJournal).filter(DailyJournal.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    if payload.mood is not None:
        entry.mood = payload.mood
    if payload.notes is not None:
        entry.notes = payload.notes
    if payload.mistakes is not None:
        entry.mistakes = payload.mistakes
    entry.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(entry)
    return entry
