// Codified from "FTSE Quad Setup — Rulebook" (Oct 11, 2026, @Mark).
// Generalised here to any instrument with a defined cash-open time; applied to
// DE30EUR and SPX500 on the 5-minute timeframe per the dashboard's daily workflow.

export type QuadInstrumentKey = 'DE30EUR' | 'SPX500';

export interface QuadInstrumentConfig {
  label: string;
  /** Cash-session open used for the "open has settled" no-trade window. */
  openLocal: string;
}

// ASSUMPTION — confirm: the rulebook's no-trade window is anchored to the FTSE's
// 08:00 UK open. DE30EUR and SPX500 have their own cash opens; these are the
// standard ones. Adjust if your broker/feed uses different session hours.
export const QUAD_INSTRUMENTS: Record<QuadInstrumentKey, QuadInstrumentConfig> = {
  DE30EUR: { label: 'DAX / DE30EUR', openLocal: '08:00 CET (Xetra cash open)' },
  SPX500: { label: 'S&P 500 / SPX500', openLocal: '09:30 ET / 14:30 UK (NYSE cash open)' },
};

// ASSUMPTION — unresolved in the rulebook ("Still to confirm"). Rulebook offered
// 30 or 60 minutes; defaulting to the tighter 30. Change if you decide otherwise.
export const NO_TRADE_WINDOW_MINUTES = 30;

// ASSUMPTION — rulebook leaves the 44-stochastic smoothing unspecified
// ("44 (smoothing to confirm)"). Defaulting to the common smoothing of 3.
export const STOCH_44_SMOOTHING = 3;

export const OVERSOLD = 20;
export const OVERBOUGHT = 80;

export interface QuadVerdict {
  instrument: string;
  timeframe: string;
  conditions: {
    valid_channel: { met: boolean; note: string };
    price_at_line: { met: boolean; note: string };
    full_quad: {
      met: boolean;
      direction: 'LONG' | 'SHORT' | null;
      readings: { '9-3': number | null; '14-3': number | null; '44': number | null; '60-10': number | null };
      note: string;
    };
    with_trend: { met: boolean; note: string };
    open_settled: { met: boolean; note: string };
    divergence: { present: boolean; required: boolean; note: string };
  };
  trade_valid: boolean;
  direction: 'LONG' | 'SHORT' | null;
  hand: 'NONE' | 'THREE_OF_A_KIND' | 'FULL_HOUSE' | 'FOUR_OF_A_KIND' | 'THE_NUTS';
  entry_trigger: string;
  stop: string;
  exit_plan: string;
  summary: string;
  caveats: string[];
  error?: string;
  raw_analysis?: string;
}

export function buildQuadSetupPrompt(instrumentKey: QuadInstrumentKey, timeframe: string): string {
  const cfg = QUAD_INSTRUMENTS[instrumentKey];
  return `GS Trading Desk analyst. Evaluate this ${timeframe} ${cfg.label} chart strictly against the "Quad Setup" rulebook below. Be conservative: if a condition can't be confirmed from the chart, mark it not met and say why in the note.

CHART SHOULD SHOW: price with 200 MA, 50 EMA, 20 EMA, VWAP; and four stochastics — 9-3 (fastest, entry/exit trigger), 14-3 (fast confirmation), 44 with smoothing ${STOCH_44_SMOOTHING} (medium-term confirmation), 60-10 (slowest, underlying strength/weakness). Oversold = below ${OVERSOLD}. Overbought = above ${OVERBOUGHT}.

ALL SIX CONDITIONS MUST BE TRUE TO TRADE. If one is missing, it's a pass — report trade_valid: false.

1. Valid channel — built from three pivots: a line through two pivots on one side, a parallel through the third pivot on the other side. The market must draw it; a line forced onto only two points is invalid.
2. Price at the line — price closes in the area of influence of the channel line (lower line for a long, upper line for a short). Doesn't need to be exact.
3. Full Quad — all four stochastics simultaneously in the same zone: all below ${OVERSOLD} for a long, all above ${OVERBOUGHT} for a short. Three out of four is only a "pair," not a Quad — mark not met.
4. With the trend — in an uptrend, only longs at the lower line are standard; a short at the top of an uptrend REQUIRES a divergence (condition 6 becomes compulsory). Mirror in a downtrend.
5. Open has settled — the setup candle must sit outside the no-trade window: the first ${NO_TRADE_WINDOW_MINUTES} minutes after this instrument's cash open (${cfg.openLocal}). Read the actual time off the chart's x-axis.
6. Divergence (required only when condition 4 makes it compulsory; otherwise optional and only upgrades the hand) — price vs. stochastic at the line. Use the candle body's high/low, not the wick, unless the chart only allows reading the wick.

ENTRY TRIGGER (provisional): long when 9-3 turns back up through ${OVERSOLD} while the other three are still below it; short when 9-3 turns back down through ${OVERBOUGHT} while the other three are still above it.

STOP (provisional): a close beyond the channel line, UNLESS it's a volume-spike flush through the line while the Quad is still intact (hold through that) — but if the Quad has also broken, the exception is void.

EXIT: long — when 9-3 rotates back down to ${OVERSOLD} while 60-10 still holds above ${OVERBOUGHT}, take it off. Short — when 9-3 reaches/breaches ${OVERBOUGHT}, take it off.

HAND / SIZE (sizing signal only — no position size or risk % is defined yet, per the rulebook; report the hand, not a size):
- Three of a kind: Quad at a valid channel line.
- Full house: Quad + line + divergence.
- Four of a kind: Quad + double-top/double-bottom divergence in the channel.
- The nuts: Quad + running divergence (three tops/bottoms, three lower/higher stochastic highs/lows).
- Below three of a kind (any condition missing): NONE — not traded.

PASS LIST (if any apply, trade_valid must be false): three-of-four stochastics only; Quad with no channel line nearby; channel drawn off only two pivots; anything inside the no-trade window; a short at the top of an uptrend without a divergence.

Return ONLY valid JSON (no markdown), exactly this shape:
{
  "instrument": "${cfg.label}",
  "timeframe": "${timeframe}",
  "conditions": {
    "valid_channel": { "met": true|false, "note": "<brief>" },
    "price_at_line": { "met": true|false, "note": "<brief>" },
    "full_quad": { "met": true|false, "direction": "LONG"|"SHORT"|null, "readings": { "9-3": <number|null>, "14-3": <number|null>, "44": <number|null>, "60-10": <number|null> }, "note": "<brief>" },
    "with_trend": { "met": true|false, "note": "<brief>" },
    "open_settled": { "met": true|false, "note": "<brief, state the time read off the chart>" },
    "divergence": { "present": true|false, "required": true|false, "note": "<brief>" }
  },
  "trade_valid": true|false,
  "direction": "LONG"|"SHORT"|null,
  "hand": "NONE"|"THREE_OF_A_KIND"|"FULL_HOUSE"|"FOUR_OF_A_KIND"|"THE_NUTS",
  "entry_trigger": "<specific price/condition, or 'n/a'>",
  "stop": "<specific price/condition, or 'n/a'>",
  "exit_plan": "<one sentence>",
  "summary": "<2-3 sentences>",
  "caveats": ["<anything uncertain or not fully readable from the chart>"]
}`;
}
