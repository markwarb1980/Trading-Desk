import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicClient } from '@/lib/anthropic';
import { buildQuadSetupPrompt, QUAD_INSTRUMENTS, type QuadInstrumentKey } from '@/lib/quadSetupRules';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const client = createAnthropicClient();
    const formData = await request.formData();
    const imageFile = formData.get('image') as File | null;
    const instrument = formData.get('instrument') as string | null;
    const timeframe = (formData.get('timeframe') as string | null) || '5M';

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (!instrument || !(instrument in QUAD_INSTRUMENTS)) {
      return NextResponse.json(
        { error: `Invalid instrument. Expected one of: ${Object.keys(QUAD_INSTRUMENTS).join(', ')}` },
        { status: 400 }
      );
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(imageFile.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPEG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mediaType = imageFile.type as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
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
              text: buildQuadSetupPrompt(instrument as QuadInstrumentKey, timeframe),
            },
          ],
        },
      ],
    });

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

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
    console.error('[quad-setup] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
