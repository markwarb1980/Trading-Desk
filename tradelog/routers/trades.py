from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from tradelog.database import get_db
from tradelog.models.trade import Trade
from tradelog.models.tag import Tag

router = APIRouter(prefix="/api/trades", tags=["trades"])


class TradeCreate(BaseModel):
    symbol: str
    direction: str
    entry_price: float
    exit_price: Optional[float] = None
    entry_time: datetime
    exit_time: Optional[datetime] = None
    size: float
    pnl: Optional[float] = None
    fees: float = 0.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    r_multiple: Optional[float] = None
    notes: Optional[str] = None
    setup_id: Optional[int] = None
    status: str = "closed"
    broker_id: Optional[str] = None
    tag_ids: List[int] = []


class TradeUpdate(BaseModel):
    symbol: Optional[str] = None
    direction: Optional[str] = None
    entry_price: Optional[float] = None
    exit_price: Optional[float] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    size: Optional[float] = None
    pnl: Optional[float] = None
    fees: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    r_multiple: Optional[float] = None
    notes: Optional[str] = None
    setup_id: Optional[int] = None
    status: Optional[str] = None
    broker_id: Optional[str] = None
    tag_ids: Optional[List[int]] = None


class TagResponse(BaseModel):
    id: int
    name: str
    category: str
    color: Optional[str] = None

    class Config:
        from_attributes = True


class TradeResponse(BaseModel):
    id: int
    symbol: str
    direction: str
    entry_price: float
    exit_price: Optional[float] = None
    entry_time: datetime
    exit_time: Optional[datetime] = None
    size: float
    pnl: Optional[float] = None
    fees: float
    net_pnl: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    r_multiple: Optional[float] = None
    notes: Optional[str] = None
    setup_id: Optional[int] = None
    status: str
    broker_id: Optional[str] = None
    created_at: datetime
    tag_ids: List[int] = []
    tags: List[TagResponse] = []

    class Config:
        from_attributes = True


def trade_to_response(trade: Trade) -> TradeResponse:
    return TradeResponse(
        id=trade.id,
        symbol=trade.symbol,
        direction=trade.direction,
        entry_price=trade.entry_price,
        exit_price=trade.exit_price,
        entry_time=trade.entry_time,
        exit_time=trade.exit_time,
        size=trade.size,
        pnl=trade.pnl,
        fees=trade.fees,
        net_pnl=trade.net_pnl,
        stop_loss=trade.stop_loss,
        take_profit=trade.take_profit,
        r_multiple=trade.r_multiple,
        notes=trade.notes,
        setup_id=trade.setup_id,
        status=trade.status,
        broker_id=trade.broker_id,
        created_at=trade.created_at,
        tag_ids=[t.id for t in trade.tags],
        tags=[TagResponse.model_validate(t) for t in trade.tags],
    )


@router.get("/", response_model=List[TradeResponse])
def list_trades(
    symbol: Optional[str] = None,
    direction: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    setup_id: Optional[int] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Trade)
    if symbol:
        q = q.filter(Trade.symbol.ilike(f"%{symbol}%"))
    if direction:
        q = q.filter(Trade.direction == direction)
    if status:
        q = q.filter(Trade.status == status)
    if date_from:
        q = q.filter(Trade.entry_time >= date_from)
    if date_to:
        q = q.filter(Trade.entry_time <= date_to)
    if setup_id is not None:
        q = q.filter(Trade.setup_id == setup_id)
    q = q.order_by(Trade.entry_time.desc())
    trades = q.offset(offset).limit(limit).all()
    return [trade_to_response(t) for t in trades]


@router.get("/{trade_id}", response_model=TradeResponse)
def get_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    return trade_to_response(trade)


@router.post("/", response_model=TradeResponse, status_code=201)
def create_trade(payload: TradeCreate, db: Session = Depends(get_db)):
    net_pnl = None
    if payload.pnl is not None:
        net_pnl = payload.pnl - payload.fees

    trade = Trade(
        symbol=payload.symbol,
        direction=payload.direction,
        entry_price=payload.entry_price,
        exit_price=payload.exit_price,
        entry_time=payload.entry_time,
        exit_time=payload.exit_time,
        size=payload.size,
        pnl=payload.pnl,
        fees=payload.fees,
        net_pnl=net_pnl,
        stop_loss=payload.stop_loss,
        take_profit=payload.take_profit,
        r_multiple=payload.r_multiple,
        notes=payload.notes,
        setup_id=payload.setup_id,
        status=payload.status,
        broker_id=payload.broker_id,
    )

    if payload.tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(payload.tag_ids)).all()
        trade.tags = tags

    db.add(trade)
    db.commit()
    db.refresh(trade)
    return trade_to_response(trade)


@router.put("/{trade_id}", response_model=TradeResponse)
def update_trade(trade_id: int, payload: TradeUpdate, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")

    update_data = payload.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)

    for key, value in update_data.items():
        setattr(trade, key, value)

    # Recalculate net_pnl if pnl or fees changed
    pnl = trade.pnl
    fees = trade.fees
    if pnl is not None:
        trade.net_pnl = pnl - (fees or 0.0)

    if tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        trade.tags = tags

    db.commit()
    db.refresh(trade)
    return trade_to_response(trade)


@router.delete("/{trade_id}", status_code=204)
def delete_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    db.delete(trade)
    db.commit()


@router.post("/{trade_id}/tags", response_model=TradeResponse)
def attach_tags(trade_id: int, tag_ids: List[int], db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    trade.tags = tags
    db.commit()
    db.refresh(trade)
    return trade_to_response(trade)
