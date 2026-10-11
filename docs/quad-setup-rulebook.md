# Quad Setup — Rulebook (v2)

Source: `FTSE Quad Setup — Rulebook` (Oct 11, 2026, @Mark), updated v2.
Generalised here for daily use on **DE30EUR** and **SPX500** on the
**5-minute** timeframe, and implemented in the dashboard as the "QUAD SETUP"
panel (`components/QuadSetup.tsx`, `app/api/quad-setup/route.ts`,
`lib/quadSetupRules.ts` — that last file is the single source of truth the
code reads from).

## The one setup

There is one trade: a full Quad at a valid channel line, in the direction of
the channel, after the open has settled. Every condition must be a clear
yes. If you have to argue yourself into it, it is a no.

A 9-3 divergence at the line makes the hand bigger. **It is the only thing
that allows a trade against the channel.**

## Chart and definitions

Price chart: 200 MA, 50 EMA, 20 EMA and VWAP. Below it: the four
stochastics. Nothing else.

| Term | Exact meaning |
|---|---|
| Oversold / overbought | Below 20 / above 80 |
| 9-3 | Fastest stochastic. Gives the entry trigger, the exit signal, **and the divergence**. |
| 14-3, 44 | Confirmation (44 smoothed at **3**, assumed — unconfirmed) |
| 60-10 | Underlying strength. Slowest to reach the zone. |
| Long Quad | 9-3, 14-3, 44 and 60-10 all below 20 at the same time |
| Short Quad | All four above 80 at the same time |
| Pair | Three of the four in the zone. Not a Quad. |
| Valid channel | Built from three pivots: a line through two pivots on one side, a parallel line through one pivot on the other. Two pivots is not a channel. |
| Up-channel / down-channel | Both lines slope up / both slope down. This is the trend. |
| Area of influence | Price touching or within a few points of the channel line. Doesn't need to be exact. |
| Embedded | 60-10 stays above 80 (strong) or below 20 (weak) for an extended period. (Context term, not a checklist step.) |

## 9-3 divergence — now graded

Compare the 9-3 at this swing with the 9-3 at the previous swing. Previous
swing (Part 1): use the candle body's high/low, ignore the wick. This swing
(Part 2): the wick counts.

| Grade | Long (buy) | Short (sell) | Counts? |
|---|---|---|---|
| Strong | Price lower low, 9-3 higher low | Price higher high, 9-3 lower high | **Yes** |
| Medium | Price equal low, 9-3 higher low | Price equal high, 9-3 lower high | **Yes** |
| Weak | Price lower low, 9-3 equal low | Price higher high, 9-3 equal high | No |
| Hidden | Price higher low, 9-3 lower low | Price lower high, 9-3 higher high | Not used (decision pending) |

Only Strong or Medium divergence counts for anything — allowing a
counter-trend entry, or upgrading the hand.

## The checklist — work in order, stop at the first "no"

**Long**
1. Outside the no-trade window after the open?
2. Valid channel with three pivots?
3. Price in the area of influence of the **lower** channel line?
4. All four stochastics below 20 at the same time?
5. Is the channel sloping **up**?
   - Yes → go to 6.
   - No (down-channel) → only allowed with a **Strong or Medium** 9-3 buy
     divergence. If there isn't one, stop.
6. Grade the hand, then wait for the entry trigger.

**Short** — the mirror: upper channel line, all four above 80, channel
sloping down (or a qualifying sell divergence if it isn't).

The open is 08:00 UK (12:30 IST until 25 Oct 2026, 13:30 IST after UK clocks
go back) for the original FTSE rulebook — see the per-instrument opens used
for DE30EUR/SPX500 below.

## Entry, stop, exit (unchanged from v1)

- **Entry (provisional)**: long when 9-3 turns back up through 20 while the
  other three are still below 20; short when 9-3 turns back down through 80
  while the other three are still above 80.
- **Stop (provisional)**: close beyond the channel line — except a
  volume-spike flush through the line while the Quad is still intact (hold
  through it). If the Quad has also broken, the exception is void — get out.
- **Exit long**: 9-3 rotates back down to 20 while 60-10 still holds above
  80 — take it off, no second-guessing.
- **Exit short**: 9-3 reaches/breaches 80 — take it off.

## Sizing by hand (unchanged from v1)

Bigger hand, bigger bet. Below three of a kind is not traded. **Actual
position size / risk per hand is still not set.**

| Hand | On the chart | Size |
|---|---|---|
| Three of a kind | Quad at a valid channel line | Base |
| Full house | Quad + line + a counting divergence | Larger than base |
| Four of a kind | Quad + double-top/bottom divergence in channel | Larger again |
| The nuts | Quad + running divergence (3 tops/bottoms, 3 lower/higher stochastic highs/lows) | Maximum |

## No-trade list (unchanged)

Pass on: three-of-four stochastics; a Quad with no channel line nearby; a
channel drawn off only two pivots; anything during the open; a short at the
top of an uptrend without a (counting) divergence; any trade taken just to
feel active.

## Discipline (unchanged)

You are the weak link, not the method. One setup, mastered. Perfect
practice. Losses are part of the business; size for them. Expect long waits.

## Still open (unchanged from v1 — not yet decided)

Carried over verbatim from the source rulebook's own "still to confirm"
list; nothing new was resolved in v2:

| Item | Status in code |
|---|---|
| 44-stochastic smoothing | Defaulted to **3** (`STOCH_44_SMOOTHING`) — confirm or change. |
| No-trade window length (30 or 60 min) | Defaulted to **30 min** (`NO_TRADE_WINDOW_MINUTES`) — confirm or change. |
| Cash-open time per instrument | DE30EUR → 08:00 CET (Xetra); SPX500 → 09:30 ET / 14:30 UK (NYSE). The source rulebook is FTSE-specific (08:00 UK) — these two are standard opens, not from the source doc. Confirm. |
| Entry trigger alternative to 9-3 cross | Not changed — kept as specified. |
| Stop alternative (fixed points vs. channel close) | Not changed — kept as specified. |
| **Position size / risk per hand** | **Not set.** The panel reports the hand only, never a size or risk amount — a financial decision for you to make. |
| Whether the v2.0 macro score still filters direction above this setup | Not wired in. The dashboard already has a macro score (`components/MacroScore.tsx`) — gating Quad trades by it is a follow-up change, not assumed here. |
| "Hidden" divergence | Detected and reported, but never counts (per the rulebook: "decision pending"). |

## How the daily workflow works

The "QUAD SETUP" panel on the dashboard has two upload slots, DE30EUR and
SPX500. Each day: screenshot the 5-minute chart (200 MA / 50 EMA / 20 EMA /
VWAP + all four stochastics visible), drop it into the matching slot, and
Claude works the checklist above in order, stopping at the first failing
step (with the divergence rescue at step 5), and returns the verdict, hand,
and entry/stop if valid. Same upload → Claude-vision pattern as the
dashboard's existing DAX/FTSE "Chart Analysis" panel — no live TradingView
connection required.

### Getting notified automatically

Claude has no live connection to TradingView (no API, no browser access
from the dashboard's hosting environment), so the above still needs a
screenshot each day. To cut that down to "only check when something's
actually forming," two Pine Script indicators in `pine/` run directly on
your TradingView chart and alert you the moment a Full Quad forms outside
the no-trade window — see `pine/README.md` for install and alert setup.
They only automate the objectively-computable steps (open-settled, Full
Quad, entry trigger); channel validity, price-at-line, and divergence
grading still need your eye before you trust the alert, exactly as the
rulebook requires.
