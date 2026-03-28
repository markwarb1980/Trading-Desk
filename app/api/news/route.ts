import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 90;
export const runtime = 'nodejs';

function buildPrompt() {
  const now = new Date();
  return `You are a financial news analyst for DAX and FTSE 100 traders. Today is ${now.toUTCString()}.

TASK 1 — FOREX FACTORY ECONOMIC CALENDAR:
Search for today's and tomorrow's economic calendar events from Forex Factory (forexfactory.com/calendar).
Focus on HIGH and MEDIUM impact events for USD, EUR, GBP currencies.
Key events to find: NFP, CPI, PPI, FOMC, GDP, Retail Sales, PMI, ISM, BOE/ECB/Fed decisions, unemployment claims.

TASK 2 — FINANCIAL NEWS HEADLINES:
Search for the 6 most important financial news headlines TODAY relevant to European equity traders.
Look for: central bank news, geopolitical events, major economic data, equity market moves.
Search: "DAX news today", "FTSE 100 news today", "European markets", "Fed ECB BOE news".

TASK 3 — SESSION & NO-TRADE WINDOWS:
Current IST time is ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST.
Identify any active no-trade windows (within 30 minutes before/after HIGH impact events).

Return ONLY valid JSON (no markdown):
{
  "headlines": [
    {
      "title": "<headline>",
      "source": "<source name>",
      "impact": "HIGH|MEDIUM|LOW",
      "direction": "BULLISH|BEARISH|NEUTRAL",
      "summary": "<one sentence>",
      "time_ago": "<e.g. 2h ago>"
    }
  ],
  "calendar": [
    {
      "time_utc": "<HH:MM>",
      "time_ist": "<HH:MM>",
      "date": "<YYYY-MM-DD>",
      "event": "<event name>",
      "currency": "<USD|EUR|GBP|etc>",
      "impact": "HIGH|MEDIUM|LOW",
      "forecast": "<value or N/A>",
      "previous": "<value or N/A>",
      "actual": "<value if released, else null>",
      "no_trade_window": <true if HIGH impact within 30min>
    }
  ],
  "session_status": {
    "current_time_ist": "<HH:MM IST>",
    "active_sessions": ["<London|New York|Asia>"],
    "next_session": "<next session name and open time IST>",
    "no_trade_active": <true|false>
  },
  "market_mood": "RISK_ON|RISK_OFF|NEUTRAL",
  "key_events_today": ["<most important event 1>", "<event 2>", "<event 3>"],
  "timestamp": "<ISO 8601>"
}`;
}

export async function GET() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, buildPrompt(), 3000);
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
