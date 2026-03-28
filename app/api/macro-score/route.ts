import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MACRO_PROMPT = `You are a senior Goldman Sachs macro analyst trading DAX (GER40) and FTSE 100 for a trader based in New Delhi, India (IST). You use a macro-first institutional approach inspired by Soros, Druckenmiller, and Paul Tudor Jones.

Today is ${new Date().toUTCString()}.

Use web search to gather the LATEST market data, then calculate the macro score.

SEARCH FOR:
1. Gold (XAU/USD) price and trend — leading risk indicator
2. Brent Oil price — Iran risk / FTSE driver
3. GBP/USD — FTSE inverse signal
4. EUR/USD — DAX inverse signal
5. S&P 500 — global risk lead
6. VIX level — fear gauge
7. DAX and FTSE 100 current levels and today's performance
8. Latest ECB, BOE, Fed statements or decisions
9. Any major geopolitical events today (especially Iran, Middle East, Ukraine)
10. High-impact economic data released today or due tomorrow

SCORING SYSTEM (Goldman Sachs macro framework):

Group A — Geopolitical / Risk Sentiment (range: -3 to +3):
  Read from: VIX level, Gold trend, geopolitical headlines, Oil price action
  +3 = extreme risk-on (VIX <15, gold falling, no crises, equities surging)
  +2 = risk-on
  +1 = slight risk-on
   0 = neutral
  -1 = slight risk-off
  -2 = risk-off (VIX 20-25, gold rising, tensions elevated)
  -3 = extreme risk-off (VIX >30, gold surging, active geopolitical crisis)

Group B — Central Banks (range: -2 to +2):
  Read from: Fed/ECB/BOE recent language, rate expectations, USD strength
  +2 = very dovish (rate cuts imminent, QE, weak guidance)
  +1 = dovish lean
   0 = neutral / on hold
  -1 = hawkish lean
  -2 = very hawkish (hikes, QT, fighting inflation)

Group C — Market Direction (range: -3 to +3):
  Read from: S&P 500, DAX, FTSE 100 — trend, momentum, price action
  +3 = all three in strong bull trend with momentum
  +2 = broadly bullish
  +1 = slightly bullish / mixed with upward lean
   0 = sideways / truly mixed
  -1 = slightly bearish / mixed with downward lean
  -2 = broadly bearish
  -3 = all three in strong bear trend (sell-off mode)

News Adjustment — Tier 1 events only (range: -1 to +1 per major event, max ±2):
  Tier 1 events: ECB/BOE/FOMC decisions, NFP, CPI, GDP
  +1 per bullish Tier 1 catalyst, -1 per bearish Tier 1 catalyst

TRADEABLE THRESHOLD — GS RULES (CRITICAL):
  ±6 to ±8 = TIER 1 — Full size trade (1% account risk). Trade confirmed.
  ±4 to ±5 = TIER 2 — Half size (0.5% risk). KEY level required for entry.
  ±3 or less = NO TRADE — Absolute rule, no exceptions.
  Direction only trades — never counter-trend.

Return ONLY valid JSON (no markdown):
{
  "scores": {
    "geopolitical_risk": <integer -3 to 3>,
    "central_banks": <integer -2 to 2>,
    "market_direction": <integer -3 to 3>,
    "news_adjustment": <integer -2 to 2>
  },
  "total_score": <integer capped -8 to +8>,
  "tier": <1, 2, or "NO TRADE">,
  "tradeable": <true if |total_score| >= 4, else false>,
  "direction": <"LONG", "SHORT", or "NO TRADE">,
  "risk_size": <"Full size (1% risk)" if Tier 1, "Half size (0.5% risk)" if Tier 2, "NO TRADE" if not tradeable>,
  "reasoning": {
    "geopolitical_risk": "<one sentence with specific data: VIX level, gold move, key events>",
    "central_banks": "<one sentence with specific data: latest CB language, rate expectations>",
    "market_direction": "<one sentence with specific data: S&P/DAX/FTSE levels and moves>",
    "news_adjustment": "<Tier 1 events today and their impact, or 'No Tier 1 events today'>"
  },
  "key_levels": {
    "dax_watch": "<key DAX level to watch today>",
    "ftse_watch": "<key FTSE level to watch today>"
  },
  "session_notes": "<specific notes for IST trader: which windows to focus on today>",
  "summary": "<2-3 sentence GS-style executive summary — be direct and specific>",
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "prices_found": {
    "gold": "<price>", "brent_oil": "<price>", "gbp_usd": "<price>",
    "eur_usd": "<price>", "sp500": "<price>", "dax": "<price>",
    "ftse100": "<price>", "vix": "<level>"
  },
  "timestamp": "<ISO 8601>"
}`;

export async function POST() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, MACRO_PROMPT, 2000);
    const data = extractJSON(rawText);

    if (typeof data.total_score === 'number') {
      data.total_score = Math.max(-8, Math.min(8, data.total_score));
    }
    if (!data.timestamp) data.timestamp = new Date().toISOString();

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[macro-score] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
