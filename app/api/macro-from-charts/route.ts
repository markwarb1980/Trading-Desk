import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/anthropic';

export const maxDuration = 120;
export const runtime = 'nodejs';

const ANALYSIS_PROMPT = `You are a professional macro analyst and trader specialising in DAX and FTSE 100.

You have been given chart screenshots for multiple instruments. Analyse ALL of them together to produce a holistic macro score and trend assessment.

For each instrument chart provided, identify:
- Current trend direction (bullish/bearish/sideways)
- Key price levels
- Momentum (accelerating/decelerating)
- Any notable patterns

Then synthesise across all instruments using this scoring system:

GROUP A — Geopolitical/Risk Sentiment (max ±3):
  Read from: Gold trend, Oil trend, overall risk appetite
  +3 = extreme risk-on (gold falling, equities surging)
  -3 = extreme risk-off (gold surging, equities collapsing, oil spiking on geopolitics)

GROUP B — Central Banks / Macro (max ±2):
  Read from: USD pairs (GBP/USD, EUR/USD), Gold vs USD relationship
  +2 = dovish signals (USD weakening, gold rising on rate cut bets)
  -2 = hawkish signals (USD strengthening, gold falling)

GROUP C — Market Direction (max ±3):
  Read from: S&P 500, DAX, FTSE 100 charts directly
  +3 = all three in strong bull trend
  -3 = all three in strong bear trend

NEWS ADJUSTMENT (max ±2): Set to 0 since no live news — focus on chart evidence only.

Return ONLY valid JSON (no markdown, no explanation):
{
  "instrument_readings": {
    "gold":    { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "note": "<one line>" },
    "oil":     { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "note": "<one line>" },
    "gbp_usd": { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "note": "<one line>" },
    "sp500":   { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "note": "<one line>" },
    "dax":     { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "note": "<one line>" },
    "ftse":    { "trend": "BULLISH|BEARISH|SIDEWAYS", "key_level": "<price>", "note": "<one line>" }
  },
  "scores": {
    "geopolitical_risk": <integer -3 to 3>,
    "central_banks":     <integer -2 to 2>,
    "market_direction":  <integer -3 to 3>,
    "news_adjustment":   0
  },
  "total_score": <sum capped -8 to +8>,
  "tier": <1, 2, or 3, or "NO TRADE">,
  "direction": <"LONG", "SHORT", or "NO TRADE">,
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

    // Extract JSON
    let result: Record<string, unknown>;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      [null, textContent.match(/\{[\s\S]*\}/)?.[0] || ''];
    try {
      result = JSON.parse((jsonMatch[1] || '').trim());
    } catch {
      const objectMatch = textContent.match(/\{[\s\S]*\}/);
      result = objectMatch ? JSON.parse(objectMatch[0]) : { raw: textContent };
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
