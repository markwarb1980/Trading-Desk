// Codified from "FTSE Quad Setup — Rulebook" (Oct 11, 2026, @Mark), v2.
// v2 restructured the setup from six unordered conditions into a strict,
// sequential checklist (stop at the first "no") with a graded 9-3 divergence
// that is the only way to trade against the channel's own slope.
// Generalised here to any instrument with a defined cash-open time; applied
// to DE30EUR and SPX500 on the 5-minute timeframe per the dashboard's daily
// workflow.

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

// ASSUMPTION — still unresolved in the rulebook ("Still to confirm"). Rulebook
// offers 30 or 60 minutes; defaulting to the tighter 30. Change if decided.
export const NO_TRADE_WINDOW_MINUTES = 30;

// ASSUMPTION — rulebook leaves the 44-stochastic smoothing unspecified
// ("Still to confirm"). Defaulting to the common smoothing of 3.
export const STOCH_44_SMOOTHING = 3;

export const OVERSOLD = 20;
export const OVERBOUGHT = 80;

export type DivergenceGrade = 'STRONG' | 'MEDIUM' | 'WEAK' | 'HIDDEN' | 'NONE';

export interface QuadVerdict {
  instrument: string;
  timeframe: string;
  checklist: {
    step1_open_settled: { met: boolean; note: string };
    step2_valid_channel: { met: boolean; note: string };
    step3_price_at_line: { met: boolean; note: string };
    step4_full_quad: {
      met: boolean;
      direction: 'LONG' | 'SHORT' | null;
      readings: { '9-3': number | null; '14-3': number | null; '44': number | null; '60-10': number | null };
      note: string;
    };
    step5_trend_aligned: {
      met: boolean;
      channel_slope: 'UP' | 'DOWN' | 'FLAT' | null;
      note: string;
    };
  };
  divergence: {
    grade: DivergenceGrade;
    counts: boolean; // true only for STRONG or MEDIUM
    direction: 'BUY' | 'SELL' | null;
    note: string;
  };
  stopped_at_step: number | null; // 1-5, the first failing step; null = reached step 6
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
  return `GS Trading Desk analyst. Evaluate this ${timeframe} ${cfg.label} chart strictly against the "Quad Setup" rulebook (v2) below. Work through the checklist IN ORDER and stop at the first "no" — exactly as the rulebook requires. Be conservative: if a step can't be confirmed from the chart, mark it not met and say why in the note.

CHART SHOULD SHOW: price with 200 MA, 50 EMA, 20 EMA, VWAP; below it, four stochastics — 9-3 (fastest: entry trigger, exit signal, AND divergence), 14-3 and 44 (confirmation, 44 smoothed at ${STOCH_44_SMOOTHING}), 60-10 (slowest, underlying strength/weakness).

DEFINITIONS:
- Oversold / overbought: below ${OVERSOLD} / above ${OVERBOUGHT}.
- Long Quad: 9-3, 14-3, 44 and 60-10 all below ${OVERSOLD} at the same time. Short Quad: all four above ${OVERBOUGHT} at the same time. Three of four is a "pair" — not a Quad.
- Valid channel: built from three pivots — a line through two pivots on one side, a parallel line through the third pivot on the other side. Two pivots is NOT a channel; never force a line onto two points.
- Up-channel / down-channel: both lines slope up / both slope down. This is the trend.
- Area of influence: price touching or within a few points of the channel line — doesn't need to be exact.
- Embedded (context only, not a required step): 60-10 stays above ${OVERBOUGHT} (strong) or below ${OVERSOLD} (weak) for an extended period.

9-3 DIVERGENCE (the ONLY thing that allows a trade against the channel's slope):
Compare the 9-3 at this swing to the 9-3 at the previous swing. For the previous swing (Part 1), use the candle body's high/low and ignore the wick. For this swing (Part 2), the wick counts.
- STRONG (counts): long — price lower low, 9-3 higher low. short — price higher high, 9-3 lower high.
- MEDIUM (counts): long — price equal low, 9-3 higher low. short — price equal high, 9-3 lower high.
- WEAK (does not count): long — price lower low, 9-3 equal low. short — price higher high, 9-3 equal high.
- HIDDEN (not used — decision pending; detect and report it, but it never counts): long — price higher low, 9-3 lower low. short — price lower high, 9-3 higher high.
Only STRONG or MEDIUM divergence counts for anything (allowing a counter-trend entry, or upgrading the hand).

THE CHECKLIST — work the steps in order for whichever side (long or short) the stochastics are actually forming a Quad toward. Stop at the first "no":
1. Open has settled — outside the no-trade window: the first ${NO_TRADE_WINDOW_MINUTES} minutes after this instrument's cash open (${cfg.openLocal}). Read the actual time off the chart's x-axis.
2. Valid channel — three pivots, as defined above.
3. Price at the line — in the area of influence of the LOWER channel line for a long, the UPPER channel line for a short.
4. Full Quad — all four stochastics simultaneously in the same zone (below ${OVERSOLD} for long, above ${OVERBOUGHT} for short).
5. Trend aligned — is the channel sloping the same way as the trade (up-channel for a long, down-channel for a short)?
   - Yes → proceed (this step is met).
   - No (trading against the channel's slope) → met ONLY if there is a STRONG or MEDIUM 9-3 divergence in the trade's direction. Otherwise this step fails and the setup stops here.
6. (Not a pass/fail step) Grade the hand and report the provisional entry trigger.

If any step 1-5 fails (and, for step 5, no qualifying divergence rescues it), trade_valid is false and stopped_at_step records the first failing step number. If all five pass, stopped_at_step is null and trade_valid is true.

ENTRY TRIGGER (provisional): long when 9-3 turns back up through ${OVERSOLD} while the other three are still below it; short when 9-3 turns back down through ${OVERBOUGHT} while the other three are still above it.

STOP (provisional): a close beyond the channel line, UNLESS it's a volume-spike flush through the line while the Quad is still intact (hold through that) — but if the Quad has also broken, the exception is void.

EXIT: long — when 9-3 rotates back down to ${OVERSOLD} while 60-10 still holds above ${OVERBOUGHT}, take it off. Short — when 9-3 reaches/breaches ${OVERBOUGHT}, take it off.

HAND / SIZE (sizing signal only — no position size or risk % is defined yet; report the hand, not a size):
- Three of a kind: Quad at a valid channel line (steps 1-5 all met via trend alignment, no divergence needed).
- Full house: Quad + line + a counting (Strong/Medium) divergence.
- Four of a kind: Quad + double-top/double-bottom divergence in the channel.
- The nuts: Quad + running divergence (three tops/bottoms, three lower/higher stochastic highs/lows).
- Below three of a kind (any step failed, no rescue): NONE — not traded.

Return ONLY valid JSON (no markdown), exactly this shape:
{
  "instrument": "${cfg.label}",
  "timeframe": "${timeframe}",
  "checklist": {
    "step1_open_settled": { "met": true|false, "note": "<brief, state the time read off the chart>" },
    "step2_valid_channel": { "met": true|false, "note": "<brief>" },
    "step3_price_at_line": { "met": true|false, "note": "<brief>" },
    "step4_full_quad": { "met": true|false, "direction": "LONG"|"SHORT"|null, "readings": { "9-3": <number|null>, "14-3": <number|null>, "44": <number|null>, "60-10": <number|null> }, "note": "<brief>" },
    "step5_trend_aligned": { "met": true|false, "channel_slope": "UP"|"DOWN"|"FLAT"|null, "note": "<brief>" }
  },
  "divergence": { "grade": "STRONG"|"MEDIUM"|"WEAK"|"HIDDEN"|"NONE", "counts": true|false, "direction": "BUY"|"SELL"|null, "note": "<brief>" },
  "stopped_at_step": <1-5 or null>,
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
