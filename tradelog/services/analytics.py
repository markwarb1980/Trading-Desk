from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import Optional
import pandas as pd

from tradelog.models.trade import Trade


class AnalyticsService:
    def __init__(self, db: Session):
        self.db = db

    def _query_trades(self, date_from: Optional[datetime], date_to: Optional[datetime]) -> pd.DataFrame:
        q = self.db.query(Trade).filter(Trade.status == "closed")
        if date_from:
            q = q.filter(Trade.entry_time >= date_from)
        if date_to:
            q = q.filter(Trade.entry_time <= date_to)
        trades = q.all()
        if not trades:
            return pd.DataFrame()
        rows = []
        for t in trades:
            rows.append({
                "id": t.id,
                "symbol": t.symbol,
                "direction": t.direction,
                "entry_time": t.entry_time,
                "exit_time": t.exit_time,
                "pnl": t.pnl,
                "net_pnl": t.net_pnl,
                "r_multiple": t.r_multiple,
                "fees": t.fees,
            })
        df = pd.DataFrame(rows)
        df["entry_time"] = pd.to_datetime(df["entry_time"])
        if "exit_time" in df.columns:
            df["exit_time"] = pd.to_datetime(df["exit_time"])
        return df

    def get_summary(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> dict:
        df = self._query_trades(date_from, date_to)
        if df.empty:
            return {
                "win_rate": 0.0,
                "profit_factor": 0.0,
                "avg_win": 0.0,
                "avg_loss": 0.0,
                "avg_r": 0.0,
                "max_drawdown": 0.0,
                "total_trades": 0,
                "total_pnl": 0.0,
                "best_day": None,
                "worst_day": None,
                "current_streak": 0,
            }

        net = df["net_pnl"].dropna()
        total_trades = len(net)
        wins = net[net > 0]
        losses = net[net < 0]

        win_rate = len(wins) / total_trades * 100 if total_trades > 0 else 0.0
        sum_wins = wins.sum()
        sum_losses = abs(losses.sum())
        profit_factor = sum_wins / sum_losses if sum_losses > 0 else (float("inf") if sum_wins > 0 else 0.0)
        avg_win = float(wins.mean()) if len(wins) > 0 else 0.0
        avg_loss = float(losses.mean()) if len(losses) > 0 else 0.0

        r_vals = df["r_multiple"].dropna()
        avg_r = float(r_vals.mean()) if len(r_vals) > 0 else 0.0

        # Max drawdown from cumulative pnl
        df_sorted = df.sort_values("entry_time")
        cum_pnl = df_sorted["net_pnl"].fillna(0).cumsum()
        rolling_max = cum_pnl.cummax()
        drawdown = cum_pnl - rolling_max
        max_drawdown = float(drawdown.min()) if len(drawdown) > 0 else 0.0

        total_pnl = float(net.sum())

        # Best/worst day
        df["date_str"] = df["entry_time"].dt.date.astype(str)
        daily = df.groupby("date_str")["net_pnl"].sum()
        best_day = str(daily.idxmax()) if len(daily) > 0 else None
        worst_day = str(daily.idxmin()) if len(daily) > 0 else None

        # Current streak
        sorted_pnl = df_sorted["net_pnl"].fillna(0).tolist()
        streak = 0
        if sorted_pnl:
            last_sign = 1 if sorted_pnl[-1] > 0 else -1
            for val in reversed(sorted_pnl):
                if val > 0 and last_sign == 1:
                    streak += 1
                elif val < 0 and last_sign == -1:
                    streak -= 1
                else:
                    break

        return {
            "win_rate": round(win_rate, 2),
            "profit_factor": round(profit_factor, 2) if profit_factor != float("inf") else 999.99,
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "avg_r": round(avg_r, 2),
            "max_drawdown": round(max_drawdown, 2),
            "total_trades": total_trades,
            "total_pnl": round(total_pnl, 2),
            "best_day": best_day,
            "worst_day": worst_day,
            "current_streak": streak,
        }

    def get_pnl_by_dow(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> list:
        df = self._query_trades(date_from, date_to)
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        result = [{"dow": i, "label": days[i], "pnl": 0.0, "trade_count": 0} for i in range(7)]
        if df.empty:
            return result
        df["dow"] = df["entry_time"].dt.dayofweek
        grouped = df.groupby("dow").agg(pnl=("net_pnl", "sum"), trade_count=("id", "count")).reset_index()
        for _, row in grouped.iterrows():
            idx = int(row["dow"])
            result[idx]["pnl"] = round(float(row["pnl"]), 2)
            result[idx]["trade_count"] = int(row["trade_count"])
        return result

    def get_pnl_by_hour(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> list:
        df = self._query_trades(date_from, date_to)
        result = [{"hour": h, "pnl": 0.0, "win_rate": 0.0, "trade_count": 0} for h in range(24)]
        if df.empty:
            return result
        df["hour"] = df["entry_time"].dt.hour
        for h, group in df.groupby("hour"):
            net = group["net_pnl"].dropna()
            total = len(net)
            wins = len(net[net > 0])
            result[int(h)]["pnl"] = round(float(net.sum()), 2)
            result[int(h)]["win_rate"] = round(wins / total * 100, 2) if total > 0 else 0.0
            result[int(h)]["trade_count"] = total
        return result

    def get_pnl_by_symbol(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> list:
        df = self._query_trades(date_from, date_to)
        if df.empty:
            return []
        result = []
        for symbol, group in df.groupby("symbol"):
            net = group["net_pnl"].dropna()
            total = len(net)
            wins = len(net[net > 0])
            result.append({
                "symbol": symbol,
                "pnl": round(float(net.sum()), 2),
                "win_rate": round(wins / total * 100, 2) if total > 0 else 0.0,
                "trade_count": total,
            })
        result.sort(key=lambda x: x["pnl"], reverse=True)
        return result

    def get_calendar(self, year: int, month: int) -> list:
        from calendar import monthrange
        start = datetime(year, month, 1)
        last_day = monthrange(year, month)[1]
        end = datetime(year, month, last_day, 23, 59, 59)

        q = self.db.query(Trade).filter(
            Trade.status == "closed",
            Trade.entry_time >= start,
            Trade.entry_time <= end,
        ).all()

        daily: dict = {}
        for t in q:
            d = t.entry_time.date().isoformat()
            if d not in daily:
                daily[d] = {"date": d, "pnl": 0.0, "trade_count": 0}
            daily[d]["pnl"] += (t.net_pnl or 0.0)
            daily[d]["trade_count"] += 1

        result = []
        for d, info in daily.items():
            info["pnl"] = round(info["pnl"], 2)
            result.append(info)
        result.sort(key=lambda x: x["date"])
        return result

    def get_equity_curve(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> list:
        df = self._query_trades(date_from, date_to)
        if df.empty:
            return []
        df = df.sort_values("entry_time")
        df["date"] = df["entry_time"].dt.date.astype(str)
        daily = df.groupby("date")["net_pnl"].sum().reset_index()
        daily["cumulative_pnl"] = daily["net_pnl"].cumsum()
        return [
            {"date": row["date"], "cumulative_pnl": round(float(row["cumulative_pnl"]), 2)}
            for _, row in daily.iterrows()
        ]

    def get_drawdown(self, date_from: Optional[datetime] = None, date_to: Optional[datetime] = None) -> list:
        df = self._query_trades(date_from, date_to)
        if df.empty:
            return []
        df = df.sort_values("entry_time")
        df["date"] = df["entry_time"].dt.date.astype(str)
        daily = df.groupby("date")["net_pnl"].sum().reset_index()
        daily["cum_pnl"] = daily["net_pnl"].cumsum()
        daily["rolling_max"] = daily["cum_pnl"].cummax()
        daily["drawdown"] = daily["cum_pnl"] - daily["rolling_max"]
        return [
            {"date": row["date"], "drawdown": round(float(row["drawdown"]), 2)}
            for _, row in daily.iterrows()
        ]
