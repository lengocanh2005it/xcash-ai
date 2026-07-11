import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { LlmToolCall, LlmUsage } from '../llm-adapter.interface';

export interface AccumulatedCompletion {
  content: string;
  toolCalls: LlmToolCall[];
  usage: LlmUsage | undefined;
  finishReason: string | null;
}

interface ToolCallFragment {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/**
 * Ráp content + tool_calls từ chuỗi ChatCompletionChunk streaming.
 * OpenAI trả tool_calls dạng fragment theo `index`, phải tự accumulate.
 */
export class ToolCallAccumulator {
  private content = '';
  private readonly toolCallsByIndex = new Map<number, ToolCallFragment>();
  private usage: LlmUsage | undefined;
  private finishReason: string | null = null;

  push(chunk: ChatCompletionChunk): void {
    if (chunk.usage) this.usage = chunk.usage;

    const choice = chunk.choices[0];
    if (!choice) return;

    if (choice.finish_reason) this.finishReason = choice.finish_reason;

    const delta = choice.delta;
    if (delta?.content) this.content += delta.content;

    for (const tc of delta?.tool_calls ?? []) {
      const existing = this.toolCallsByIndex.get(tc.index);
      if (!existing) {
        this.toolCallsByIndex.set(tc.index, {
          id: tc.id ?? '',
          type: 'function',
          function: {
            name: tc.function?.name ?? '',
            arguments: tc.function?.arguments ?? '',
          },
        });
      } else {
        if (tc.id) existing.id = tc.id;
        if (tc.function?.name) existing.function.name += tc.function.name;
        if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
      }
    }
  }

  result(): AccumulatedCompletion {
    const toolCalls = [...this.toolCallsByIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, tc]) => tc as LlmToolCall);

    return {
      content: this.content,
      toolCalls,
      usage: this.usage,
      finishReason: this.finishReason,
    };
  }
}
