import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 90;
export const runtime = 'nodejs';

const NEWS_PROMPT = `You are a financial news analyst. Search for today's major financial news and upcoming economic calendar events.

Today is ${new Date().toUTCString()}.

TASK 1 — NEWS HEADLINES:
Search for the 6 most important financial/market news headlines from TODAY that would impact European equity traders (DAX, FTSE 100).
Prioritise: central bank news, geopolitical events, major economic data releases, equity market moves.

TASK 2 — ECONOMIC CALENDAR:
Search for important economic data releases scheduled for TODAY and the next 2 days that impact DAX/FTSE traders.
Include: US NFP, CPI, PPI, FOMC, GDP, Retail Sales | EU/Eurozone: CPI, GDP, PMI | UK: CPI, GDP, BOE decisions, PMI.

Return ONLY valid JSON (no markdown):
{
  "headlines": [
    {
      "title": "<headline text>",
      "source": "<news source>",
      "impact": "<HIGH | MEDIUM | LOW>",
      "direction": "<BULLISH | BEARISH | NEUTRAL for DAX/FTSE>",
      "summary": "<one sentence summary>",
      "time_ago": "<e.g. 2h ago, 30m ago, just now>"
    }
  ],
  "calendar": [
    {
      "time_utc": "<HH:MM UTC>",
      "time_ist": "<HH:MM IST>",
      "date": "<YYYY-MM-DD>",
      "event": "<event name>",
      "currency": "<USD | EUR | GBP | etc>",
      "impact": "<HIGH | MEDIUM | LOW>",
      "forecast": "<consensus forecast if available, else 'N/A'>",
      "previous": "<previous reading if available, else 'N/A'>",
      "no_trade_window": <true if HIGH impact and within 30min of release, else false>
    }
  ],
  "session_status": {
    "current_time_ist": "<current IST time HH:MM>",
    "active_sessions": ["<session names currently open>"],
    "next_session": "<next session to open>",
    "no_trade_active": <true if currently in a no-trade window>
  },
  "market_mood": "<RISK_ON | RISK_OFF | NEUTRAL — overall mood from headlines>",
  "timestamp": "<ISO 8601>"
}`;

export async function GET() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, NEWS_PROMPT, 3000);
    const data = extractJSON(rawText);

    if (!data.timestamp) {
      data.timestamp = new Date().toISOString();
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[news] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
