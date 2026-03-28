from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from tradelog.database import get_db
from tradelog.models.playbook import Playbook
from tradelog.models.trade import Trade

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])


class PlaybookCreate(BaseModel):
    name: str
    description: Optional[str] = None
    rules: Optional[str] = None
    criteria: Optional[str] = None


class PlaybookUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    rules: Optional[str] = None
    criteria: Optional[str] = None


class PlaybookResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    rules: Optional[str] = None
    criteria: Optional[str] = None
    created_at: datetime
    trade_count: int = 0
    win_rate: float = 0.0

    class Config:
        from_attributes = True


def build_playbook_response(pb: Playbook, db: Session) -> PlaybookResponse:
    trades = db.query(Trade).filter(Trade.setup_id == pb.id, Trade.status == "closed").all()
    total = len(trades)
    wins = sum(1 for t in trades if t.net_pnl is not None and t.net_pnl > 0)
    win_rate = round(wins / total * 100, 2) if total > 0 else 0.0
    return PlaybookResponse(
        id=pb.id,
        name=pb.name,
        description=pb.description,
        rules=pb.rules,
        criteria=pb.criteria,
        created_at=pb.created_at,
        trade_count=total,
        win_rate=win_rate,
    )


@router.get("/", response_model=List[PlaybookResponse])
def list_playbooks(db: Session = Depends(get_db)):
    playbooks = db.query(Playbook).order_by(Playbook.name).all()
    return [build_playbook_response(pb, db) for pb in playbooks]


@router.get("/{playbook_id}", response_model=PlaybookResponse)
def get_playbook(playbook_id: int, db: Session = Depends(get_db)):
    pb = db.query(Playbook).filter(Playbook.id == playbook_id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    return build_playbook_response(pb, db)


@router.post("/", response_model=PlaybookResponse, status_code=201)
def create_playbook(payload: PlaybookCreate, db: Session = Depends(get_db)):
    existing = db.query(Playbook).filter(Playbook.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Playbook name already exists")
    pb = Playbook(
        name=payload.name,
        description=payload.description,
        rules=payload.rules,
        criteria=payload.criteria,
    )
    db.add(pb)
    db.commit()
    db.refresh(pb)
    return build_playbook_response(pb, db)


@router.put("/{playbook_id}", response_model=PlaybookResponse)
def update_playbook(playbook_id: int, payload: PlaybookUpdate, db: Session = Depends(get_db)):
    pb = db.query(Playbook).filter(Playbook.id == playbook_id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(pb, key, value)
    db.commit()
    db.refresh(pb)
    return build_playbook_response(pb, db)


@router.delete("/{playbook_id}", status_code=204)
def delete_playbook(playbook_id: int, db: Session = Depends(get_db)):
    pb = db.query(Playbook).filter(Playbook.id == playbook_id).first()
    if not pb:
        raise HTTPException(status_code=404, detail="Playbook not found")
    db.delete(pb)
    db.commit()
