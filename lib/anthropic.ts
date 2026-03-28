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
  maxTokens = 4096
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: prompt },
  ];

  let finalText = '';

  for (let iteration = 0; iteration < 4; iteration++) {
    // Cast to any because web_search_20250305 is a server-side built-in tool
    // not yet reflected in the SDK's TypeScript types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await (client.messages.create as any)({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    }) as RawResponse;

    // Collect any text blocks in this response
    const textParts = raw.content
      .filter((b: RawBlock) => b.type === 'text' && typeof b.text === 'string')
      .map((b: RawBlock) => b.text as string);

    if (textParts.length > 0) {
      finalText = textParts.join('\n');
    }

    if (raw.stop_reason === 'end_turn') {
      break;
    }

    // If stop_reason is 'tool_use', continue the agentic loop
    if (raw.stop_reason === 'tool_use') {
      // Add assistant turn (typed as any to accept server-side tool blocks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages.push({ role: 'assistant', content: raw.content as any });

      // Acknowledge each tool_use so the loop continues
      const toolUseBlocks = raw.content.filter(
        (b: RawBlock) => b.type === 'tool_use' && b.id
      );

      if (toolUseBlocks.length > 0) {
        const isLastIteration = iteration >= 2; // after 3 searches, demand JSON
        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
          (b: RawBlock) => ({
            type: 'tool_result',
            tool_use_id: b.id as string,
            content: isLastIteration
              ? 'Search done. Output ONLY the JSON object now. No preamble, no markdown, no explanation. Start with { immediately.'
              : 'Search done.',
          })
        );
        messages.push({ role: 'user', content: toolResults });
      } else {
        break;
      }
    } else {
      // Unknown stop reason — exit loop
      break;
    }
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
