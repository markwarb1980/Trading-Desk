import { NextResponse } from 'next/server';
import { createAnthropicClient, callWithWebSearch, extractJSON } from '@/lib/anthropic';

export const maxDuration = 120;
export const runtime = 'nodejs';

const MACRO_PROMPT = `GS macro analyst. Today: ${new Date().toUTCString()}. IST trader, DAX + FTSE 100.

Search for CURRENT: Gold price/trend, Brent Oil, GBP/USD, EUR/USD, S&P 500, VIX, DAX level, FTSE level, any ECB/BOE/Fed news, major geopolitical events.

SCORING:
A) Geopolitical/Risk (-3 to +3): VIX, gold, oil, geopolitics
B) Central Banks (-2 to +2): Fed/ECB/BOE language, USD strength
C) Market Direction (-3 to +3): S&P, DAX, FTSE trend
D) News Adjustment (-2 to +2): Tier 1 only (CPI/NFP/FOMC/GDP)

TIERS: ±6-8=TIER1 (1% risk), ±4-5=TIER2 (0.5% risk), ±3 or less=NO TRADE.

Return ONLY valid JSON:
{"scores":{"geopolitical_risk":<-3 to 3>,"central_banks":<-2 to 2>,"market_direction":<-3 to 3>,"news_adjustment":<-2 to 2>},"total_score":<-8 to 8>,"tier":<1,2,"NO TRADE">,"tradeable":<bool>,"direction":<"LONG","SHORT","NO TRADE">,"risk_size":<"Full size (1% risk)","Half size (0.5% risk)","NO TRADE">,"reasoning":{"geopolitical_risk":"<data>","central_banks":"<data>","market_direction":"<data>","news_adjustment":"<data>"},"key_levels":{"dax_watch":"<level>","ftse_watch":"<level>"},"session_notes":"<IST window notes>","summary":"<2 sentence summary>","key_risks":["<r1>","<r2>","<r3>"],"prices_found":{"gold":"<p>","brent_oil":"<p>","gbp_usd":"<p>","eur_usd":"<p>","sp500":"<p>","dax":"<p>","ftse100":"<p>","vix":"<p>"},"timestamp":"<ISO>"}`;

export async function POST() {
  try {
    const client = createAnthropicClient();
    const rawText = await callWithWebSearch(client, MACRO_PROMPT, 1000);
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
