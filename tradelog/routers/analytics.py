from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from tradelog.database import get_db
from tradelog.services.analytics import AnalyticsService

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def get_service(db: Session = Depends(get_db)) -> AnalyticsService:
    return AnalyticsService(db)


@router.get("/summary")
def get_summary(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_summary(date_from, date_to)


@router.get("/pnl-by-dow")
def pnl_by_dow(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_pnl_by_dow(date_from, date_to)


@router.get("/pnl-by-hour")
def pnl_by_hour(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_pnl_by_hour(date_from, date_to)


@router.get("/pnl-by-symbol")
def pnl_by_symbol(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_pnl_by_symbol(date_from, date_to)


@router.get("/calendar")
def calendar(
    year: int = Query(...),
    month: int = Query(...),
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_calendar(year, month)


@router.get("/equity-curve")
def equity_curve(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_equity_curve(date_from, date_to)


@router.get("/drawdown")
def drawdown(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    svc: AnalyticsService = Depends(get_service),
):
    return svc.get_drawdown(date_from, date_to)
