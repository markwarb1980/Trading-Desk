import os
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from tradelog.models.trade import Trade


class AICoach:
    """Uses Anthropic Claude to analyze trading patterns and provide coaching."""

    def __init__(self, db: Session):
        self.db = db

    def analyze(
        self,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> str:
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")

        # Fetch trades
        if date_from is None:
            date_from = datetime.utcnow() - timedelta(days=30)
        if date_to is None:
            date_to = datetime.utcnow()

        trades = (
            self.db.query(Trade)
            .filter(Trade.entry_time >= date_from, Trade.entry_time <= date_to)
            .order_by(Trade.entry_time.asc())
            .all()
        )

        if not trades:
            return (
                "No trades found in the selected date range. "
                "Add some trades to your journal to receive AI coaching insights."
            )

        # Build summary stats
        closed_trades = [t for t in trades if t.status == "closed" and t.net_pnl is not None]
        total = len(closed_trades)
        wins = [t for t in closed_trades if t.net_pnl > 0]
        losses = [t for t in closed_trades if t.net_pnl < 0]
        win_rate = round(len(wins) / total * 100, 1) if total > 0 else 0
        total_pnl = round(sum(t.net_pnl for t in closed_trades), 2) if closed_trades else 0
        avg_win = round(sum(t.net_pnl for t in wins) / len(wins), 2) if wins else 0
        avg_loss = round(sum(t.net_pnl for t in losses) / len(losses), 2) if losses else 0

        r_trades = [t for t in closed_trades if t.r_multiple is not None]
        avg_r = round(sum(t.r_multiple for t in r_trades) / len(r_trades), 2) if r_trades else None

        # Build trade list string
        trade_lines = []
        for t in trades[:50]:  # Limit to 50 trades for context window
            tags_str = ", ".join(tag.name for tag in t.tags) if t.tags else "none"
            line = (
                f"  - {t.entry_time.date()} | {t.symbol} | {t.direction} | "
                f"PnL: {t.net_pnl} | R: {t.r_multiple} | "
                f"Tags: {tags_str} | Notes: {(t.notes or 'none')[:80]}"
            )
            trade_lines.append(line)

        summary = f"""Trading Performance Summary ({date_from.date()} to {date_to.date()}):
- Total Trades: {total}
- Win Rate: {win_rate}%
- Total P&L: ${total_pnl}
- Avg Win: ${avg_win}
- Avg Loss: ${avg_loss}
- Avg R-Multiple: {avg_r if avg_r is not None else 'N/A'}
- Long trades: {sum(1 for t in trades if t.direction == 'LONG')}
- Short trades: {sum(1 for t in trades if t.direction == 'SHORT')}

Individual Trades (most recent 50):
{chr(10).join(trade_lines)}"""

        prompt = f"""{summary}

Based on this trading data, please provide:
1. **Patterns Identified**: Key patterns in winning and losing trades
2. **Recurring Mistakes**: Specific mistakes that are costing money
3. **Strongest Setups**: Which setups/symbols/times are performing best
4. **Weaknesses**: Areas needing the most improvement
5. **3 Concrete Recommendations**: Specific, actionable steps to improve performance immediately

Be specific and data-driven. Reference actual trades and numbers from the data."""

        if not api_key:
            return self._placeholder_analysis(total, win_rate, total_pnl, avg_win, avg_loss)

        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2048,
                system=(
                    "You are an expert trading coach analyzing a trader's journal. "
                    "Be specific, direct, and data-driven. Use the actual numbers provided."
                ),
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text
        except Exception as e:
            return (
                f"AI analysis unavailable: {str(e)}\n\n"
                + self._placeholder_analysis(total, win_rate, total_pnl, avg_win, avg_loss)
            )

    def _placeholder_analysis(
        self,
        total: int,
        win_rate: float,
        total_pnl: float,
        avg_win: float,
        avg_loss: float,
    ) -> str:
        pf = round(abs(avg_win / avg_loss), 2) if avg_loss != 0 else 0
        return f"""## AI Coaching Analysis (Demo Mode)

*Set ANTHROPIC_API_KEY environment variable to enable real AI analysis.*

### Patterns Identified
Based on your {total} trades with a {win_rate}% win rate and ${total_pnl} total P&L:
- Your profit factor is approximately {pf}, which {'is above 1.0 — a good sign' if pf > 1 else 'needs improvement to exceed 1.0'}
- {'You win more often than you lose, focus on maximizing your winners' if win_rate > 50 else 'Win rate below 50% — ensure your winners are significantly larger than your losers'}

### Recurring Mistakes
- Review trades where you exited early and left profit on the table
- Check if you are moving stop losses against your position
- Look for overtrading patterns on losing days

### Strongest Setups
- Analyze your highest R-multiple trades to identify common entry criteria
- Focus on the time of day and symbols that generate the most consistent results

### Weaknesses
- {'Average loss (${:.2f}) needs to be managed more tightly'.format(avg_loss) if avg_loss < -avg_win else 'Average win (${:.2f}) could be improved by holding winners longer'.format(avg_win)}
- Review journal entries on losing days for emotional trading patterns

### 3 Concrete Recommendations
1. **Set a daily loss limit**: Stop trading after losing {'${:.2f}'.format(abs(avg_loss) * 2)} in a single day
2. **Journal every trade**: Add notes on your reasoning before and after each trade
3. **Review weekly**: Every Friday, review your trades and identify your top mistake of the week
"""
