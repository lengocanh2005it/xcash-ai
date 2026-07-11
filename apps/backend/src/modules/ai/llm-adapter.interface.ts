import type OpenAI from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';

export type LlmMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;
export type LlmTool = OpenAI.Chat.Completions.ChatCompletionTool;
export type LlmToolCall = OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall;
export type LlmUsage = OpenAI.Completions.CompletionUsage;

/**
 * Lõi LLM tráo được — mỗi provider (OpenAI, MiniMax, ...) implement adapter này.
 * Harness sở hữu agent loop; adapter chỉ gọi 1 lượt streaming chat completion.
 */
export interface LlmAdapter {
  readonly name: string;

  streamChatCompletion(
    messages: LlmMessage[],
    tools: LlmTool[],
  ): AsyncIterable<ChatCompletionChunk>;
}
