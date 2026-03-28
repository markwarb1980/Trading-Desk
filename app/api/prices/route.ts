import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 60;
export const runtime = 'nodejs';

const PRICES_PROMPT = `You are a financial data assistant. Search for the current live market prices RIGHT NOW.

Today is ${new Date().toUTCString()}.

Search for and return the latest prices for:
1. Gold (XAU/USD) spot price
2. Brent Crude Oil price
3. GBP/USD exchange rate
4. EUR/USD exchange rate
5. S&P 500 index (latest price or last close)
6. DAX index (latest price or last close)
7. FTSE 100 index (latest price or last close)

For each asset, find: current/last price, day change (absolute), and percentage change.

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "gold": {
    "price": "<price as string, e.g. 2345.60>",
    "change": "<absolute change, e.g. +12.30 or -5.40>",
    "change_pct": "<percentage, e.g. +0.53% or -0.23%>",
    "direction": "<up, down, or flat>"
  },
  "brent_oil": {
    "price": "<price>",
    "change": "<change>",
    "change_pct": "<pct>",
    "direction": "<up/down/flat>"
  },
  "gbp_usd": {
    "price": "<price>",
    "change": "<change>",
    "change_pct": "<pct>",
    "direction": "<up/down/flat>"
  },
  "eur_usd": {
    "price": "<price>",
    "change": "<change>",
    "change_pct": "<pct>",
    "direction": "<up/down/flat>"
  },
  "sp500": {
    "price": "<price>",
    "change": "<change>",
    "change_pct": "<pct>",
    "direction": "<up/down/flat>"
  },
  "dax": {
    "price": "<price>",
    "change": "<change>",
    "change_pct": "<pct>",
    "direction": "<up/down/flat>"
  },
  "ftse100": {
    "price": "<price>",
    "change": "<change>",
    "change_pct": "<pct>",
    "direction": "<up/down/flat>"
  },
  "timestamp": "<ISO 8601 timestamp>"
}`;

export async function GET() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, PRICES_PROMPT, 2048);
    const data = extractJSON(rawText);

    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[prices] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
