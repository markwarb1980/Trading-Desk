import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MACRO_PROMPT = `You are a professional macro trading analyst specialising in European equity indices (DAX and FTSE 100).

Today is ${new Date().toUTCString()}.

Use web search to gather the LATEST market data and news, then return a trading macro score.

SEARCH FOR:
1. Current VIX level and gold price (risk sentiment)
2. Latest Fed, ECB, and BOE statements or decisions
3. Today's performance of S&P 500, DAX, and FTSE 100
4. Any major geopolitical events or financial news today
5. Current prices: Gold (XAU/USD), Brent Crude, GBP/USD, EUR/USD, S&P 500, DAX, FTSE 100

SCORING SYSTEM:
Group A — Geopolitical/Risk sentiment (range: -3 to +3):
  +3 = extreme risk-on (low VIX, gold falling, stable geopolitics)
  0  = neutral
  -3 = extreme risk-off (VIX spike, gold surging, active crisis)

Group B — Central Banks (range: -2 to +2):
  +2 = very dovish (rate cuts, QE signals, weak economic guidance)
  0  = neutral / on hold
  -2 = very hawkish (aggressive hikes, QT, inflation fighting)

Group C — Market Direction (range: -3 to +3):
  +3 = strong bull trend (S&P, DAX, FTSE all rallying with momentum)
  0  = sideways / mixed
  -3 = strong bear trend (broad sell-off, deteriorating technicals)

News Adjustment (range: -2 to +2):
  +2 = very positive catalysts today
  0  = neutral / no major news
  -2 = very negative catalysts today

TIER LOGIC (based on absolute total_score):
  Tier 1: |score| >= 5  (strong signal — take the trade)
  Tier 2: |score| = 3 or 4  (moderate signal — trade with caution)
  Tier 3: |score| = 1 or 2  (weak signal — small size only)
  NO TRADE: score = 0

DIRECTION:
  Positive score → LONG
  Negative score → SHORT
  Zero → NO TRADE

After gathering data, return ONLY a valid JSON object with this exact structure (no markdown, no explanation):
{
  "scores": {
    "geopolitical_risk": <integer -3 to 3>,
    "central_banks": <integer -2 to 2>,
    "market_direction": <integer -3 to 3>,
    "news_adjustment": <integer -2 to 2>
  },
  "total_score": <integer, sum of above capped at -8 to +8>,
  "tier": <1, 2, 3, or "NO TRADE">,
  "direction": <"LONG", "SHORT", or "NO TRADE">,
  "reasoning": {
    "geopolitical_risk": "<one concise sentence with data points>",
    "central_banks": "<one concise sentence with data points>",
    "market_direction": "<one concise sentence with data points>",
    "news_adjustment": "<one concise sentence with data points>"
  },
  "summary": "<2-3 sentence executive summary for DAX/FTSE traders>",
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "prices_found": {
    "gold": "<price with unit>",
    "brent_oil": "<price with unit>",
    "gbp_usd": "<price>",
    "eur_usd": "<price>",
    "sp500": "<price>",
    "dax": "<price>",
    "ftse100": "<price>"
  },
  "timestamp": "<ISO 8601 timestamp>"
}`;

export async function POST() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, MACRO_PROMPT, 4096);

    const data = extractJSON(rawText);

    // Clamp total_score to [-8, +8]
    if (typeof data.total_score === 'number') {
      data.total_score = Math.max(-8, Math.min(8, data.total_score));
    }

    // Ensure timestamp
    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[macro-score] Error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
