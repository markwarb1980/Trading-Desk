import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/anthropic';

export const maxDuration = 120;
export const runtime = 'nodejs';

const ANALYSIS_PROMPT = `You are a senior Goldman Sachs macro analyst trading DAX (GER40) and FTSE 100. Macro-first institutional approach inspired by Soros, Druckenmiller, and Paul Tudor Jones.

You have been given chart screenshots for multiple instruments. Analyse ALL charts together to produce a holistic macro score.

CONFIRMED PATTERNS TO IDENTIFY:
1. EMA ribbon rejection — HIGH reliability. Ribbon = ceiling in downtrend, floor in uptrend.
2. Consolidation breakout — HIGH reliability. Tight range at key level = coiling. High volume next candle = enter NOW.
3. Round number behaviour — DAX: every 1,000pt = hard level. FTSE: 10,000 = major psychological level.
4. Gold leads stocks — Gold bottom precedes stock bounce. Gold reversal = warning signal.

For each instrument chart identify:
- Trend direction (BULLISH/BEARISH/SIDEWAYS)
- Key price level (support/resistance)
- EMA ribbon status (stacked bull/bear, mixed, flat)
- Pattern present (from confirmed list above)
- Momentum (accelerating/decelerating)

SCORING SYSTEM — GS FRAMEWORK:

GROUP A — Geopolitical/Risk Sentiment (max ±3):
  Read from: Gold trend (leading indicator), Oil trend (Iran/FTSE driver), risk appetite
  +3 = extreme risk-on (gold falling, no geopolitical stress)
  -3 = extreme risk-off (gold surging, oil spiking on Iran/geopolitics, VIX elevated)

GROUP B — Central Banks / FX (max ±2):
  Read from: GBP/USD (FTSE inverse signal), EUR/USD (DAX inverse signal)
  FX pair falling = USD strengthening = hawkish = negative for equities
  FX pair rising = USD weakening = dovish = positive for equities

GROUP C — Market Direction (max ±3):
  Read from: S&P 500 (global risk lead), DAX, FTSE 100 charts directly
  +3 = all three in strong bull trend with momentum
  -3 = all three in strong bear trend (sell-off mode)

NEWS ADJUSTMENT: 0 (chart-based analysis only — no live news available)

TRADEABLE THRESHOLD (GS RULES — CRITICAL):
  ±6 to ±8 = TIER 1 — Full size trade (1% account risk)
  ±4 to ±5 = TIER 2 — Half size (0.5% risk). KEY level required.
  ±3 or less = NO TRADE — Absolute rule, no exceptions.

Return ONLY valid JSON (no markdown):
{
  "instrument_readings": {
    "gold":    { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "ema_ribbon": "<BULL_STACK|BEAR_STACK|MIXED|FLAT>", "pattern": "<pattern name or none>", "note": "<one line>" },
    "oil":     { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "ema_ribbon": "<status>", "pattern": "<pattern or none>", "note": "<one line>" },
    "gbp_usd": { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "ema_ribbon": "<status>", "pattern": "<pattern or none>", "note": "<one line>" },
    "sp500":   { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "ema_ribbon": "<status>", "pattern": "<pattern or none>", "note": "<one line>" },
    "dax":     { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "ema_ribbon": "<status>", "pattern": "<pattern or none>", "note": "<one line>" },
    "ftse":    { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "ema_ribbon": "<status>", "pattern": "<pattern or none>", "note": "<one line>" }
  },
  "scores": {
    "geopolitical_risk": <integer -3 to 3>,
    "central_banks":     <integer -2 to 2>,
    "market_direction":  <integer -3 to 3>,
    "news_adjustment":   0
  },
  "total_score": <sum capped -8 to +8>,
  "tier": <1, 2, or "NO TRADE">,
  "tradeable": <true if |total_score| >= 4, else false>,
  "direction": <"LONG", "SHORT", or "NO TRADE">,
  "risk_size": <"Full size (1% risk)" if Tier 1, "Half size (0.5% risk)" if Tier 2, "NO TRADE" if not tradeable>,
  "reasoning": {
    "geopolitical_risk": "<what Gold and Oil charts tell you about risk sentiment>",
    "central_banks":     "<what FX pairs tell you about CB policy>",
    "market_direction":  "<what S&P, DAX, FTSE charts show>",
    "news_adjustment":   "Not applicable — chart-based analysis only"
  },
  "summary": "<3 sentence professional summary synthesising all charts>",
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3>"],
  "dax_outlook":  "<specific 1-2 sentence DAX trade outlook>",
  "ftse_outlook": "<specific 1-2 sentence FTSE trade outlook>",
  "timestamp": "<ISO 8601>"
}`;

export async function POST(request: Request) {
  try {
    const client: Anthropic = createAnthropicClient();
    const formData = await request.formData();

    // Collect all uploaded chart images
    const chartLabels: Record<string, string> = {
      gold: 'Gold (XAU/USD)',
      oil: 'Brent/WTI Crude Oil',
      gbp_usd: 'GBP/USD',
      sp500: 'S&P 500',
      dax: 'DAX',
      ftse: 'FTSE 100',
    };

    const imageBlocks: Anthropic.ImageBlockParam[] = [];
    const textIntros: string[] = [];

    for (const [key, label] of Object.entries(chartLabels)) {
      const file = formData.get(key) as File | null;
      if (!file) continue;

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString('base64');
      const mediaType = (file.type || 'image/png') as
        'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

      textIntros.push(`Chart ${imageBlocks.length + 1}: ${label}`);
      imageBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      });
    }

    if (imageBlocks.length === 0) {
      return NextResponse.json({ error: 'No chart images provided' }, { status: 400 });
    }

    // Build message content: interleave label text + image
    const content: Anthropic.ContentBlockParam[] = [];
    content.push({
      type: 'text',
      text: `I am providing ${imageBlocks.length} chart screenshots:\n${textIntros.join('\n')}\n\nPlease analyse all charts together.`,
    });
    for (let i = 0; i < imageBlocks.length; i++) {
      content.push({ type: 'text', text: `--- Chart ${i + 1}: ${textIntros[i]} ---` });
      content.push(imageBlocks[i]);
    }
    content.push({ type: 'text', text: ANALYSIS_PROMPT });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content }],
    });

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    // Extract JSON — try markdown block first, then bare object
    let result: Record<string, unknown>;
    let jsonStr = '';
    const mdMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (mdMatch) {
      jsonStr = mdMatch[1].trim();
    } else {
      const objMatch = textContent.match(/\{[\s\S]*\}/);
      jsonStr = objMatch ? objMatch[0] : '';
    }

    try {
      result = JSON.parse(jsonStr);
    } catch {
      // Attempt to fix truncated JSON by closing open structures
      try {
        // Count open braces/brackets and close them
        let fixed = jsonStr;
        const openBraces = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
        const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
        // Remove trailing comma if present before adding closers
        fixed = fixed.replace(/,\s*$/, '');
        for (let i = 0; i < openBrackets; i++) fixed += ']';
        for (let i = 0; i < openBraces; i++) fixed += '}';
        result = JSON.parse(fixed);
      } catch {
        result = { raw: textContent, error: 'JSON parse failed' };
      }
    }

    if (!result.timestamp) result.timestamp = new Date().toISOString();
    result.charts_uploaded = imageBlocks.length;

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[macro-from-charts] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
