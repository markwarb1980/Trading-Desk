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

  for (let iteration = 0; iteration < 10; iteration++) {
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
        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
          (b: RawBlock) => ({
            type: 'tool_result',
            tool_use_id: b.id as string,
            content: 'Search completed. Please continue your analysis using the results.',
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
    return JSON.parse(text);
  } catch {
    // Try to find JSON block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch {
        // continue
      }
    }
    // Try to find first { ... } block
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // continue
      }
    }
    throw new Error(`Could not extract JSON from response: ${text.slice(0, 200)}`);
  }
}
