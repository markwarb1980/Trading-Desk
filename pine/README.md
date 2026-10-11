# Quad Setup — Pine Scripts

Two indicators for TradingView, matching the rulebook's own chart split
(`docs/quad-setup-rulebook.md`). They automate only what's objectively
computable — everything the rulebook itself says needs a human eye stays
manual.

## Install

1. Open TradingView → open a DE30EUR or SPX500 chart → set it to **5 min**.
2. Pine Editor (bottom tab) → **New blank indicator** → delete the
   boilerplate → paste `quad-setup-overlay.pine` → **Save** → **Add to
   chart**.
3. Repeat for `quad-setup-stochastics.pine` (it opens as its own pane below
   the price chart).
4. In the stochastics indicator's settings (gear icon), set:
   - **No-trade window**: the instrument's cash-open window, exchange local
     time. DE30EUR → `0800-0830` with timezone `Europe/Berlin` (Xetra open).
     SPX500 → `0930-1000` with timezone `America/New_York` (NYSE open).
     (30-minute window is the dashboard's own default assumption — change
     both here and in `lib/quadSetupRules.ts` if you decide on 60 instead.)
   - **44-stochastic smoothing**: defaults to 3, matching the dashboard app.

## What's automated vs. not

| Checklist step | Automated here? |
|---|---|
| 1. Open has settled | Yes — background shading + gates every alert |
| 2. Valid channel (3 pivots) | **No** — draw and judge by eye |
| 3. Price at the line | **No** — by eye |
| 4. Full Quad | Yes — background shading + alert conditions |
| 5. Trend aligned / divergence | **No** — by eye (divergence grading especially needs human judgement) |
| Entry trigger (9-3 cross) | Yes — triangle markers + alert conditions, but only meaningful once 2/3/5 are confirmed |

## Setting alerts

Right-click the chart → **Add alert** → **Condition**: "Quad Setup —
Stochastics & Alerts" → pick one of:
- `Full Quad - LONG` / `Full Quad - SHORT` — fires the moment all four
  stochastics are simultaneously in zone outside the no-trade window.
- `Entry Trigger - LONG` / `Entry Trigger - SHORT` — fires on the 9-3
  cross-back-through trigger.

Set the alert to notify however you want (app push, email, or webhook).
When it fires: confirm the channel, price-at-line, and trend/divergence by
eye, then screenshot the chart and drop it into the dashboard's "QUAD
SETUP" panel for the full six-step verdict and hand grading.
