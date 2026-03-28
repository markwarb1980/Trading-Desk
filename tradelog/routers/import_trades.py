from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from tradelog.database import get_db
from tradelog.models.trade import Trade
from tradelog.services.csv_parser import CSVParser

router = APIRouter(prefix="/api/import", tags=["import"])


@router.post("/csv")
async def import_csv(
    file: UploadFile = File(...),
    format: str = Query("auto", description="mt4|ibkr|generic|auto"),
    db: Session = Depends(get_db),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    parser = CSVParser()

    try:
        trade_dicts, errors = parser.parse(content, format)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    imported = 0
    skipped = 0

    for td in trade_dicts:
        try:
            # Calculate net_pnl
            pnl = td.get("pnl")
            fees = td.get("fees", 0.0) or 0.0
            net_pnl = (pnl - fees) if pnl is not None else None

            trade = Trade(
                symbol=td.get("symbol", "UNKNOWN"),
                direction=td.get("direction", "LONG"),
                entry_price=float(td.get("entry_price", 0)),
                exit_price=td.get("exit_price"),
                entry_time=td.get("entry_time") or datetime.utcnow(),
                exit_time=td.get("exit_time"),
                size=float(td.get("size", 1)),
                pnl=pnl,
                fees=fees,
                net_pnl=net_pnl,
                stop_loss=td.get("stop_loss"),
                take_profit=td.get("take_profit"),
                r_multiple=td.get("r_multiple"),
                notes=td.get("notes"),
                status=td.get("status", "closed"),
                broker_id=td.get("broker_id"),
            )
            db.add(trade)
            imported += 1
        except Exception as e:
            errors.append(f"Row import error: {str(e)}")
            skipped += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {"imported": imported, "skipped": skipped, "errors": errors}


@router.get("/formats")
def get_formats():
    return [
        {
            "id": "mt4",
            "name": "MetaTrader 4/5",
            "description": "MT4/MT5 History export CSV",
            "required_columns": ["Symbol", "Type", "Size", "Price"],
            "optional_columns": ["Time", "S/L", "T/P", "Commission", "Swap", "Profit"],
        },
        {
            "id": "ibkr",
            "name": "Interactive Brokers Flex",
            "description": "IBKR Flex Query CSV export",
            "required_columns": ["Symbol", "Buy/Sell", "Quantity", "TradePrice"],
            "optional_columns": ["IBCommission", "TradeMoney", "Realized P&L", "DateTime"],
        },
        {
            "id": "generic",
            "name": "Generic CSV",
            "description": "Generic trade CSV with standard column names",
            "required_columns": ["symbol", "entry_price"],
            "optional_columns": [
                "date", "entry_time", "side", "direction", "qty", "size",
                "exit_price", "pnl", "fees",
            ],
        },
        {
            "id": "auto",
            "name": "Auto-detect",
            "description": "Automatically detects the CSV format",
            "required_columns": [],
            "optional_columns": [],
        },
    ]
