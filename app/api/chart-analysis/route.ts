import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/anthropic';

export const maxDuration = 60;
export const runtime = 'nodejs';

function buildChartPrompt(timeframe: string): string {
  return `GS Trading Desk analyst. Analyse this ${timeframe} DAX/FTSE chart.

RULES: EMA ribbon rejection (ceiling/floor), consolidation breakout = high conviction, stop = swing + 10pts buffer, BE = entry ±9pts. DAX max stop 120pts, FTSE max stop 50pts.

Return ONLY valid JSON (no markdown):
{
  "instrument": "<DAX or FTSE 100>",
  "timeframe": "${timeframe}",
  "ema_ribbon": {
    "status": "<BULLISH_STACK|BEARISH_STACK|MIXED|FLAT>",
    "price_position": "<ABOVE_RIBBON|BELOW_RIBBON|INSIDE_RIBBON>",
    "momentum": "<EXPANDING|CONTRACTING|NEUTRAL>",
    "detail": "<one sentence>"
  },
  "key_level": {
    "price": "<price>",
    "type": "<SUPPORT|RESISTANCE|BOTH>",
    "significance": "<brief reason>"
  },
  "setup": {
    "type": "<setup name>",
    "maturity": "<FORMING|DEVELOPING|CONFIRMED|EXHAUSTED>",
    "description": "<1-2 sentences>"
  },
  "entry_zone": { "range": "<price range>", "trigger": "<trigger condition>" },
  "stop_zone": { "level": "<price>", "points_risk": "<pts>", "reasoning": "<brief>" },
  "bias": "<BULLISH|BEARISH|NEUTRAL>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "caveats": ["<caveat>"],
  "summary": "<2 sentence summary>"
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
      max_tokens: 1000,
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
