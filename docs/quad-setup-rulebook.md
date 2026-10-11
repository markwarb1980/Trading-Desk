# Quad Setup — Rulebook

Source: `FTSE Quad Setup — Rulebook` (Oct 11, 2026, @Mark). Generalised here for
daily use on **DE30EUR** and **SPX500** on the **5-minute** timeframe, and
implemented in the dashboard as the "QUAD SETUP" panel
(`components/QuadSetup.tsx`, `app/api/quad-setup/route.ts`,
`lib/quadSetupRules.ts` — that last file is the single source of truth the
code reads from).

## The one setup

Trade only a solid Quad at a valid channel line, in the direction of the
trend, after the open has settled. All four stochastics must be in the zone
at the same time, at the line. If any condition is missing, there is no
trade.

A divergence at the line upgrades the hand and the size. It never replaces
the Quad.

## Chart setup

- Price chart: 200 MA, 50 EMA, 20 EMA, VWAP. Nothing else.
- Oversold = below 20. Overbought = above 80.

| Stochastic | Role |
|---|---|
| 9-3 | Fastest. Entry trigger and exit signal. |
| 14-3 | Fast confirmation. |
| 44 (smoothing **3**, assumed — unconfirmed) | Medium-term confirmation. |
| 60-10 | Underlying strength/weakness. Slowest, hardest into the zone. |

## Required conditions (all six, or pass)

1. **Valid channel** — built from three pivots: a line through two pivots on
   one side, a parallel through the third on the other. Let the market draw
   it; never force a line onto two points.
2. **Price at the line** — price closes in the channel line's area of
   influence (lower line for a long, upper for a short). Close is enough.
3. **Full Quad** — all four stochastics simultaneously below 20 (long) or
   above 80 (short). Three of four is a pair, not a Quad.
4. **With the trend** — in an uptrend, take longs at the lower line; a short
   at the top of an uptrend requires a divergence (condition 6 becomes
   compulsory). Mirror in a downtrend.
5. **Open has settled** — outside the no-trade window after the instrument's
   cash open.
6. **Divergence** (compulsory only when condition 4 requires it; otherwise
   optional and only upgrades the hand) — price vs. stochastic at the line,
   using the candle body's high/low (wick allowed only if the body isn't
   readable).

## Entry, stop, exit

- **Entry (provisional)**: long when 9-3 turns back up through 20 while the
  other three are still below 20; short when 9-3 turns back down through 80
  while the other three are still above 80.
- **Stop (provisional)**: close beyond the channel line — except a
  volume-spike flush through the line while the Quad is still intact (hold
  through it; absorbed/reversed is the expected outcome). If the Quad has
  also broken, the exception is void — get out.
- **Exit long**: 9-3 rotates back down to 20 while 60-10 still holds above
  80 — take it off, no second-guessing.
- **Exit short**: 9-3 reaches/breaches 80 — take it off.

## Sizing by hand

Bigger hand, bigger bet. Below three of a kind is not traded. **Actual
position size / risk per hand is not yet set** — this rulebook only ranks
the hand, it does not size it.

| Hand | On the chart | Size |
|---|---|---|
| Three of a kind | Quad at a valid channel line | Base |
| Full house | Quad + line + divergence | Larger than base |
| Four of a kind | Quad + double-top/bottom divergence in channel | Larger again |
| The nuts | Quad + running divergence (3 tops/bottoms, 3 lower/higher stochastic highs/lows) | Maximum |

## No-trade list

Pass on: three-of-four stochastics; a Quad with no channel line nearby; a
channel drawn off only two pivots; anything during the open; a short at the
top of an uptrend without a divergence; any trade taken just to feel active.

## Discipline

You are the weak link, not the method. One setup, mastered. Perfect
practice — a wrong trade practised is a bad habit learned. Losses are part
of the business; size for them. Expect long waits — a full Quad including
the 60-10 is rare.

## Still open (from the source rulebook — not yet decided)

These are **not** silently assumed where they carry financial risk; the code
either picks a flagged default or leaves the item undone:

| Item | Status in code |
|---|---|
| 44-stochastic smoothing | Defaulted to **3** (`STOCH_44_SMOOTHING` in `lib/quadSetupRules.ts`) — confirm or change. |
| No-trade window length (30 or 60 min) | Defaulted to **30 min** (`NO_TRADE_WINDOW_MINUTES`) — confirm or change. |
| Cash-open time per instrument | DE30EUR → 08:00 CET (Xetra); SPX500 → 09:30 ET / 14:30 UK (NYSE). Original rulebook was FTSE-specific (08:00 UK) — these are standard opens for the other two, not from the source doc. Confirm. |
| Entry trigger alternative to 9-3 cross | Not changed — kept as specified. |
| Stop alternative (fixed points vs. channel close) | Not changed — kept as specified. |
| **Position size / risk per hand** | **Not set.** The panel reports the hand only, never a size or risk amount — this is a financial decision for you to make, not one to default silently. |
| Whether the v2.0 macro score still filters direction above this setup | Not wired in. The dashboard already has a macro score (`components/MacroScore.tsx`, LONG/SHORT/NO TRADE, ±8 scale) — if you want Quad trades gated by it, that's a follow-up change, not assumed here. |

## How the daily workflow works

The "QUAD SETUP" panel on the dashboard (bottom of the page) has two upload
slots, DE30EUR and SPX500. Each day: screenshot the 5-minute chart (with the
200 MA / 50 EMA / 20 EMA / VWAP and all four stochastics visible), drop it
into the matching slot, and Claude evaluates it against all six conditions
above, returning a pass/trade-valid verdict, the hand, and the entry/stop if
valid. This reuses the same upload → Claude-vision pattern already used by
the dashboard's DAX/FTSE "Chart Analysis" panel — no live TradingView
connection is required.
