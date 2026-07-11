import type OpenAI from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { LlmAdapter, LlmMessage, LlmTool } from './llm-adapter.interface';

/**
 * Adapter cho bất kỳ provider nào expose endpoint OpenAI-compatible
 * (OpenAI, MiniMax, ...) — chỉ gọi 1 lượt streaming completion, không
 * biết gì về agent loop hay fallback. Harness sở hữu phần đó.
 */
export class OpenAiCompatibleAdapter implements LlmAdapter {
  constructor(
    readonly name: string,
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async *streamChatCompletion(
    messages: LlmMessage[],
    tools: LlmTool[],
  ): AsyncIterable<ChatCompletionChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      yield chunk;
    }
  }
}
