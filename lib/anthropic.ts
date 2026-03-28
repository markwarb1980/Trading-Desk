import Anthropic from '@anthropic-ai/sdk';

export function createAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

// Minimal typed shape we expect back from the API call
interface RawBlock {
  type: string;
  text?: string;
  id?: string;
}

interface RawResponse {
  stop_reason: string;
  content: RawBlock[];
}

/**
 * Runs a prompt through Claude with web search tool enabled.
 * Handles the agentic tool-use loop automatically.
 */
export async function callWithWebSearch(
  client: Anthropic,
  prompt: string,
  maxTokens = 1000
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ];

  let finalText = '';

  // Max 2 iterations: 1 web search + 1 JSON response
  for (let iteration = 0; iteration < 2; iteration++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (client.messages.create as any)({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: 'You are a financial data API. You MUST always respond with valid JSON only. Never apologize, never explain, never add markdown. If data is unavailable, use reasonable estimates or null. Always output the complete JSON object requested.',
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    }) as RawResponse;

    const textParts = raw.content
      .filter((b: RawBlock) => b.type === 'text' && typeof b.text === 'string')
      .map((b: RawBlock) => b.text as string);

    if (textParts.length > 0) finalText = textParts.join('\n');

    if (raw.stop_reason === 'end_turn') break;

    if (raw.stop_reason === 'tool_use') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages.push({ role: 'assistant', content: raw.content as any });

      const toolUseBlocks = raw.content.filter(
        (b: RawBlock) => b.type === 'tool_use' && b.id
      );

      if (toolUseBlocks.length > 0) {
        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
          (b: RawBlock) => ({
            type: 'tool_result',
            tool_use_id: b.id as string,
            content: 'Search complete. Now output ONLY the JSON object. Start your response with { and end with }. No other text.',
          })
        );
        messages.push({ role: 'user', content: toolResults });
      } else {
        break;
      }
    } else {
      break;
    }
  }

  // If we got text but it's not JSON, make one clean formatting call
  if (finalText && !finalText.trim().startsWith('{')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fix = await (client.messages.create as any)({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: 'You are a JSON formatter. Output ONLY valid JSON. No explanation, no markdown.',
      messages: [
        { role: 'user', content: `Using this information, output the JSON as originally requested:\n\n${finalText.slice(0, 2000)}\n\nOriginal request:\n${prompt.slice(0, 500)}` },
      ],
    }) as RawResponse;
    const fixParts = fix.content
      .filter((b: RawBlock) => b.type === 'text' && b.text)
      .map((b: RawBlock) => b.text as string);
    if (fixParts.length > 0) finalText = fixParts.join('\n');
  }

  return finalText;
}

/**
 * Extracts a JSON object from a string that may contain markdown or extra text.
 */
export function extractJSON(text: string): Record<string, unknown> {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch { /* continue */ }

  // Try markdown code block
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    try { return JSON.parse(mdMatch[1].trim()); } catch { /* continue */ }
  }

  // Find the first { and last } to extract the outermost JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch { /* continue */ }

    // Try to repair truncated JSON: close open braces/brackets
    try {
      let fixed = candidate.replace(/,\s*$/, '');
      const opens = (fixed.match(/\{/g) || []).length - (fixed.match(/\}/g) || []).length;
      const openArr = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
      for (let i = 0; i < openArr; i++) fixed += ']';
      for (let i = 0; i < opens; i++) fixed += '}';
      return JSON.parse(fixed);
    } catch { /* continue */ }
  }

  throw new Error(`Could not extract JSON from response: ${text.slice(0, 300)}`);
}
