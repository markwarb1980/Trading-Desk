import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 90;
export const runtime = 'nodejs';

function buildPrompt() {
  const now = new Date();
  const ist = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  return `Financial news analyst. Today: ${now.toUTCString()}. IST: ${ist}.

Search for: (1) top 5 financial headlines today for DAX/FTSE traders, (2) today's HIGH-impact economic calendar events (USD/EUR/GBP) from Forex Factory.

Return ONLY valid JSON:
{"headlines":[{"title":"<t>","source":"<s>","impact":"HIGH|MEDIUM|LOW","direction":"BULLISH|BEARISH|NEUTRAL","summary":"<1 sentence>","time_ago":"<e.g. 2h ago>"}],"calendar":[{"time_utc":"<HH:MM>","time_ist":"<HH:MM>","date":"<YYYY-MM-DD>","event":"<name>","currency":"<USD|EUR|GBP>","impact":"HIGH|MEDIUM|LOW","forecast":"<val>","previous":"<val>","actual":null,"no_trade_window":false}],"session_status":{"current_time_ist":"${ist}","active_sessions":[],"next_session":"<next>","no_trade_active":false},"market_mood":"RISK_ON|RISK_OFF|NEUTRAL","key_events_today":["<e1>","<e2>"],"timestamp":"<ISO>"}`;
}

export async function GET() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, buildPrompt(), 1000);
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
