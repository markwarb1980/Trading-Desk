import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/anthropic';

export const maxDuration = 60;
export const runtime = 'nodejs';

function buildChartPrompt(timeframe: string): string {
  return `You are a professional technical analyst specialising in DAX and FTSE 100 intraday trading.

Analyse this ${timeframe} chart screenshot carefully.

Provide a detailed technical analysis covering:

1. EMA RIBBON STATUS
   - Are the EMAs (typically 8, 21, 50, 200 or similar) stacked bullishly or bearishly?
   - Is price above or below the ribbon?
   - Is the ribbon expanding (trending) or contracting (ranging)?

2. KEY LEVEL
   - Identify the most significant support or resistance level visible
   - State the exact price level
   - Explain why it's significant (prior high/low, consolidation zone, etc.)

3. SETUP TYPE
   - What pattern or setup is forming? (e.g., Breakout, Pullback to EMA, Bull/Bear flag, Double top/bottom, Range break, Trend continuation, Reversal)
   - How mature/confirmed is the setup?

4. ENTRY ZONE
   - Ideal entry price range for the identified setup
   - Any entry triggers to watch for (candle close above/below, volume confirmation, etc.)

5. STOP ZONE
   - Where to place stop loss (technical invalidation level)
   - How many points of risk from the entry zone?

6. OVERALL BIAS
   - BULLISH, BEARISH, or NEUTRAL for this timeframe
   - Confidence level: HIGH, MEDIUM, or LOW
   - Any caveats or conditions that could invalidate the setup

Return your analysis as a valid JSON object ONLY (no markdown wrapper):
{
  "instrument": "<DAX or FTSE 100 — infer from chart if possible, otherwise 'Unknown'>",
  "timeframe": "15M",
  "ema_ribbon": {
    "status": "<BULLISH_STACK | BEARISH_STACK | MIXED | FLAT>",
    "price_position": "<ABOVE_RIBBON | BELOW_RIBBON | INSIDE_RIBBON>",
    "momentum": "<EXPANDING | CONTRACTING | NEUTRAL>",
    "detail": "<one sentence description>"
  },
  "key_level": {
    "price": "<exact price or range>",
    "type": "<SUPPORT | RESISTANCE | BOTH>",
    "significance": "<why this level matters>"
  },
  "setup": {
    "type": "<setup name>",
    "maturity": "<FORMING | DEVELOPING | CONFIRMED | EXHAUSTED>",
    "description": "<1-2 sentences explaining the setup>"
  },
  "entry_zone": {
    "range": "<price range e.g. 18450-18480>",
    "trigger": "<what to watch for before entering>"
  },
  "stop_zone": {
    "level": "<price level>",
    "points_risk": "<estimated risk in points>",
    "reasoning": "<why this is the invalidation level>"
  },
  "bias": "<BULLISH | BEARISH | NEUTRAL>",
  "confidence": "<HIGH | MEDIUM | LOW>",
  "caveats": ["<caveat 1>", "<caveat 2>"],
  "summary": "<2-3 sentence professional summary of what you see>"
}`;
}

export async function POST(request: Request) {
  try {
    const client = createAnthropicClient();
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const timeframe = (formData.get('timeframe') as string | null) || '15M';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPEG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    // Convert to base64
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mediaType = imageFile.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: buildChartPrompt(timeframe),
            },
          ],
        },
      ],
    });

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    // Extract JSON from response
    let analysis: Record<string, unknown>;
    try {
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1].trim());
      } else {
        const objectMatch = textContent.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          analysis = JSON.parse(objectMatch[0]);
        } else {
          analysis = { raw_analysis: textContent };
        }
      }
    } catch {
      analysis = { raw_analysis: textContent };
    }

    return NextResponse.json(analysis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[chart-analysis] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
