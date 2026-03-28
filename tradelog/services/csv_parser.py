import io
import csv
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional


class CSVParser:
    """Parses CSV trade exports from various brokers."""

    def parse(self, file_bytes: bytes, format: str = "auto") -> Tuple[List[Dict[str, Any]], List[str]]:
        """
        Parse CSV bytes into a list of trade dicts plus error messages.
        Returns (trade_list, errors).
        """
        text = file_bytes.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)

        if not rows:
            return [], ["CSV file is empty or has no data rows"]

        columns = set(rows[0].keys())

        if format == "auto":
            format = self._detect_format(columns)

        if format == "mt4":
            return self._parse_mt4(rows)
        elif format == "ibkr":
            return self._parse_ibkr(rows)
        else:
            return self._parse_generic(rows)

    def _detect_format(self, columns: set) -> str:
        """Sniff column names to pick the best format."""
        mt4_indicators = {"Type", "Symbol", "Price", "Profit", "Commission", "Swap"}
        ibkr_indicators = {"Buy/Sell", "TradePrice", "IBCommission", "Realized P&L"}

        mt4_score = len(mt4_indicators & columns)
        ibkr_score = len(ibkr_indicators & columns)

        if ibkr_score >= 2:
            return "ibkr"
        if mt4_score >= 3:
            return "mt4"
        return "generic"

    def _safe_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            cleaned = str(value).replace(",", "").replace(" ", "").strip()
            if cleaned in ("", "-", "N/A", "n/a"):
                return None
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    def _parse_datetime(self, value: str) -> Optional[datetime]:
        if not value or not str(value).strip():
            return None
        value = str(value).strip()
        formats = [
            "%Y.%m.%d %H:%M",
            "%Y.%m.%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M",
            "%m/%d/%Y",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        return None

    def _parse_mt4(self, rows: List[Dict]) -> Tuple[List[Dict], List[str]]:
        trades = []
        errors = []

        for i, row in enumerate(rows):
            try:
                trade_type = str(row.get("Type", "")).strip().lower()
                if trade_type not in ("buy", "sell"):
                    # Skip balance, deposit, withdrawal rows
                    continue

                symbol = str(row.get("Symbol", "")).strip()
                if not symbol:
                    errors.append(f"Row {i+2}: Missing symbol, skipped")
                    continue

                entry_price = self._safe_float(row.get("Price"))
                if entry_price is None:
                    errors.append(f"Row {i+2}: Missing entry price, skipped")
                    continue

                # MT4 may have "Time" and "Time.1" or "Close Time"
                entry_time_str = row.get("Time") or row.get("Open Time", "")
                exit_time_str = row.get("Time.1") or row.get("Close Time", "")

                entry_time = self._parse_datetime(str(entry_time_str))
                exit_time = self._parse_datetime(str(exit_time_str))

                close_price = self._safe_float(row.get("Price.1") or row.get("Close Price"))
                size = self._safe_float(row.get("Size") or row.get("Volume")) or 1.0
                commission = self._safe_float(row.get("Commission")) or 0.0
                swap = self._safe_float(row.get("Swap")) or 0.0
                profit = self._safe_float(row.get("Profit"))

                fees = abs(commission) + abs(swap)
                direction = "LONG" if trade_type == "buy" else "SHORT"

                trade = {
                    "symbol": symbol,
                    "direction": direction,
                    "entry_price": entry_price,
                    "exit_price": close_price,
                    "entry_time": entry_time or datetime.utcnow(),
                    "exit_time": exit_time,
                    "size": size,
                    "pnl": profit,
                    "fees": fees,
                    "stop_loss": self._safe_float(row.get("S/L")),
                    "take_profit": self._safe_float(row.get("T/P")),
                    "broker_id": str(row.get("Ticket", "")).strip() or None,
                    "status": "closed" if close_price is not None else "open",
                }
                trades.append(trade)
            except Exception as e:
                errors.append(f"Row {i+2}: {str(e)}")

        return trades, errors

    def _parse_ibkr(self, rows: List[Dict]) -> Tuple[List[Dict], List[str]]:
        trades = []
        errors = []

        for i, row in enumerate(rows):
            try:
                symbol = str(row.get("Symbol", "")).strip()
                if not symbol:
                    errors.append(f"Row {i+2}: Missing symbol, skipped")
                    continue

                buy_sell = str(row.get("Buy/Sell", "")).strip().upper()
                if buy_sell not in ("BUY", "SELL"):
                    errors.append(f"Row {i+2}: Unknown Buy/Sell value '{buy_sell}', skipped")
                    continue

                trade_price = self._safe_float(row.get("TradePrice"))
                if trade_price is None:
                    errors.append(f"Row {i+2}: Missing TradePrice, skipped")
                    continue

                quantity = self._safe_float(row.get("Quantity")) or 1.0
                commission = self._safe_float(row.get("IBCommission")) or 0.0
                realized_pnl = self._safe_float(row.get("Realized P&L"))

                dt_str = str(row.get("DateTime", "") or row.get("TradeDate", "")).strip()
                entry_time = self._parse_datetime(dt_str) or datetime.utcnow()

                direction = "LONG" if buy_sell == "BUY" else "SHORT"
                fees = abs(commission)

                trade = {
                    "symbol": symbol,
                    "direction": direction,
                    "entry_price": trade_price,
                    "exit_price": None,
                    "entry_time": entry_time,
                    "exit_time": None,
                    "size": abs(quantity),
                    "pnl": realized_pnl,
                    "fees": fees,
                    "broker_id": str(row.get("TradeID", "") or row.get("OrderID", "")).strip() or None,
                    "status": "closed",
                    "notes": str(row.get("Description", "")).strip() or None,
                }
                trades.append(trade)
            except Exception as e:
                errors.append(f"Row {i+2}: {str(e)}")

        return trades, errors

    def _parse_generic(self, rows: List[Dict]) -> Tuple[List[Dict], List[str]]:
        trades = []
        errors = []

        # Flexible column name mapping
        col_map = {
            "symbol": ["symbol", "Symbol", "SYMBOL", "ticker", "Ticker", "instrument", "Instrument"],
            "direction": ["direction", "Direction", "side", "Side", "type", "Type"],
            "entry_price": ["entry_price", "EntryPrice", "entry", "Entry", "open_price", "OpenPrice", "price", "Price"],
            "exit_price": ["exit_price", "ExitPrice", "exit", "Exit", "close_price", "ClosePrice"],
            "entry_time": ["entry_time", "EntryTime", "entry_date", "EntryDate", "date", "Date", "open_time", "OpenTime", "datetime", "DateTime", "timestamp"],
            "exit_time": ["exit_time", "ExitTime", "exit_date", "ExitDate", "close_time", "CloseTime"],
            "size": ["size", "Size", "qty", "Qty", "quantity", "Quantity", "volume", "Volume", "lots", "Lots"],
            "pnl": ["pnl", "PnL", "profit", "Profit", "gain", "Gain", "result", "Result", "realized_pnl", "RealizedPnL"],
            "fees": ["fees", "Fees", "commission", "Commission", "comm", "Comm"],
            "stop_loss": ["stop_loss", "StopLoss", "sl", "SL", "stop", "Stop"],
            "take_profit": ["take_profit", "TakeProfit", "tp", "TP", "target", "Target"],
            "notes": ["notes", "Notes", "comment", "Comment", "description", "Description"],
        }

        if not rows:
            return [], ["No data rows found"]

        available_cols = set(rows[0].keys())

        def find_col(field: str) -> Optional[str]:
            for candidate in col_map.get(field, []):
                if candidate in available_cols:
                    return candidate
            return None

        symbol_col = find_col("symbol")
        entry_price_col = find_col("entry_price")

        if not symbol_col:
            errors.append("Cannot find symbol column in CSV")
            return [], errors
        if not entry_price_col:
            errors.append("Cannot find entry_price column in CSV")
            return [], errors

        direction_col = find_col("direction")
        exit_price_col = find_col("exit_price")
        entry_time_col = find_col("entry_time")
        exit_time_col = find_col("exit_time")
        size_col = find_col("size")
        pnl_col = find_col("pnl")
        fees_col = find_col("fees")
        stop_loss_col = find_col("stop_loss")
        take_profit_col = find_col("take_profit")
        notes_col = find_col("notes")

        for i, row in enumerate(rows):
            try:
                symbol = str(row.get(symbol_col, "")).strip()
                if not symbol:
                    errors.append(f"Row {i+2}: Missing symbol, skipped")
                    continue

                entry_price = self._safe_float(row.get(entry_price_col))
                if entry_price is None:
                    errors.append(f"Row {i+2}: Missing entry_price, skipped")
                    continue

                # Determine direction
                direction = "LONG"
                if direction_col:
                    raw_dir = str(row.get(direction_col, "")).strip().upper()
                    if raw_dir in ("SHORT", "SELL", "S", "-1"):
                        direction = "SHORT"
                    elif raw_dir in ("LONG", "BUY", "B", "1"):
                        direction = "LONG"

                entry_time = None
                if entry_time_col:
                    entry_time = self._parse_datetime(str(row.get(entry_time_col, "")))

                exit_time = None
                if exit_time_col:
                    exit_time = self._parse_datetime(str(row.get(exit_time_col, "")))

                exit_price = None
                if exit_price_col:
                    exit_price = self._safe_float(row.get(exit_price_col))

                size = 1.0
                if size_col:
                    size = self._safe_float(row.get(size_col)) or 1.0

                pnl = None
                if pnl_col:
                    pnl = self._safe_float(row.get(pnl_col))

                fees = 0.0
                if fees_col:
                    fees = self._safe_float(row.get(fees_col)) or 0.0

                trade = {
                    "symbol": symbol,
                    "direction": direction,
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "entry_time": entry_time or datetime.utcnow(),
                    "exit_time": exit_time,
                    "size": abs(size),
                    "pnl": pnl,
                    "fees": fees,
                    "stop_loss": self._safe_float(row.get(stop_loss_col)) if stop_loss_col else None,
                    "take_profit": self._safe_float(row.get(take_profit_col)) if take_profit_col else None,
                    "notes": str(row.get(notes_col, "")).strip() or None if notes_col else None,
                    "status": "closed" if exit_price is not None else "open",
                }
                trades.append(trade)
            except Exception as e:
                errors.append(f"Row {i+2}: {str(e)}")

        return trades, errors
