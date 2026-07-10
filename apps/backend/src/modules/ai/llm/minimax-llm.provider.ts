import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  LlmChatResult,
  LlmMessage,
  LlmProviderAdapter,
  LlmStreamChunk,
  LlmToolDefinition,
} from './llm-provider.interface';

@Injectable()
export class MinimaxLlmProvider implements LlmProviderAdapter {
  readonly providerName = 'minimax';
  private readonly logger = new Logger(MinimaxLlmProvider.name);
  private readonly client: OpenAI | null;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('MINIMAX_API_KEY', '');
    this.defaultModel = this.configService.get<string>('MINIMAX_CHAT_MODEL', 'MiniMax-M3');
    this.client = apiKey
      ? new OpenAI({ apiKey, baseURL: 'https://api.minimax.io/v1', maxRetries: 2 })
      : null;

    if (!this.client) {
      this.logger.warn('MINIMAX_API_KEY chưa cấu hình — MiniMax adapter disabled');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async chat(params: {
    model: string;
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    toolChoice?: 'auto' | 'none';
    temperature?: number;
    maxTokens?: number;
  }): Promise<LlmChatResult> {
    if (!this.client) {
      throw new Error('MiniMax client not configured');
    }

    const { model, messages, tools, toolChoice, temperature, maxTokens } = params;

    const requestParams: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages: messages.map((m) => this.toMessage(m)),
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens ?? 1024,
    };

    if (tools?.length) {
      requestParams.tools = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      requestParams.tool_choice = toolChoice ?? 'auto';
    }

    const response = await this.client.chat.completions.create(requestParams);
    const choice = response.choices[0];

    const rawText = choice?.message?.content ?? '';
    const text = stripLlmReasoningTags(rawText);

    return {
      text: text || undefined,
      toolCalls: choice?.message?.tool_calls
        ?.filter((tc) => tc.type === 'function')
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
          }
        : undefined,
      model: response.model,
    };
  }

  async *chatStream(params: {
    model: string;
    messages: LlmMessage[];
    tools?: LlmToolDefinition[];
    toolChoice?: 'auto' | 'none';
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<LlmStreamChunk> {
    if (!this.client) {
      throw new Error('MiniMax client not configured');
    }

    const { model, messages, tools, toolChoice, temperature, maxTokens, signal } = params;

    const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
      model,
      messages: messages.map((m) => this.toMessage(m)),
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools?.length) {
      requestParams.tools = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      requestParams.tool_choice = toolChoice ?? 'auto';
    }

    const stream = await this.client.chat.completions.create(requestParams, { signal });

    const toolCallAccumulators = new Map<number, { id: string; name: string; arguments: string }>();
    // MiniMax reasoning tag state machine — strips <think>...</think> from output
    let tagState: 'outside' | 'in_think' | 'in_redacted' = 'outside';
    let buffer = '';

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;

      if (delta?.content) {
        buffer += delta.content;
        const { clean, remaining } = flushReasoningBuffer(buffer, tagState);
        tagState = remaining.state;
        buffer = remaining.buffer;
        if (clean) {
          yield { delta: clean, model: chunk.model, done: false };
        }
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = toolCallAccumulators.get(idx);
          if (existing) {
            existing.arguments += tc.function?.arguments ?? '';
          } else {
            toolCallAccumulators.set(idx, {
              id: tc.id ?? `call_${idx}`,
              name: tc.function?.name ?? '',
              arguments: tc.function?.arguments ?? '',
            });
          }
        }
      }

      if (chunk.usage) {
        const toolCalls =
          toolCallAccumulators.size > 0 ? Array.from(toolCallAccumulators.values()) : undefined;
        yield {
          toolCalls,
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
          },
          model: chunk.model,
          done: true,
        };
        return;
      }
    }

    const toolCalls =
      toolCallAccumulators.size > 0 ? Array.from(toolCallAccumulators.values()) : undefined;
    yield { toolCalls, model, done: true };
  }

  isQuotaOrBillingError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 402 || status === 429) return true;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes('insufficient_quota') || msg.includes('quota');
    }
    return false;
  }

  isRetryableError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status >= 500 && status <= 503) return true;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return msg.includes('econnreset') || msg.includes('etimedout');
    }
    return false;
  }

  private toMessage(m: LlmMessage): OpenAI.ChatCompletionMessageParam {
    if (m.role === 'tool') {
      return { role: 'tool', content: m.content, tool_call_id: m.toolCallId! };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content };
  }
}

const THINK_CLOSE = `</${'think'}>`;
const REDACTED_CLOSE = `</${'redacted_thinking'}>`;
const THINK_OPEN = `<${'think'}>`;
const REDACTED_OPEN = `<${'redacted_thinking'}>`;

function stripLlmReasoningTags(content: string): string {
  return content
    .replace(new RegExp(`[\\s\\S]*?${THINK_CLOSE}\\s*`, 'gi'), '')
    .replace(new RegExp(`[\\s\\S]*?${REDACTED_CLOSE}\\s*`, 'gi'), '')
    .replace(new RegExp(`^${THINK_OPEN}[\\s\\S]*?(?:\\n\\n|$)`, 'i'), '')
    .replace(new RegExp(`^${REDACTED_OPEN}[\\s\\S]*?(?:\\n\\n|$)`, 'i'), '')
    .trim();
}

interface TagState {
  state: 'outside' | 'in_think' | 'in_redacted';
  buffer: string;
}

/** Streaming-aware reasoning tag stripper. Returns clean text + remaining state. */
function flushReasoningBuffer(
  buffer: string,
  state: 'outside' | 'in_think' | 'in_redacted',
): { clean: string; remaining: TagState } {
  if (state === 'outside') {
    // Check if a new tag opens
    const thinkIdx = buffer.indexOf(THINK_OPEN);
    const redactedIdx = buffer.indexOf(REDACTED_OPEN);
    const tagIdx = nearestTagIndex(thinkIdx, redactedIdx);

    if (tagIdx === -1) {
      return { clean: buffer, remaining: { state: 'outside', buffer: '' } };
    }

    // Yield text before the tag
    const before = buffer.slice(0, tagIdx);
    const tagBuffer = buffer.slice(tagIdx);

    if (tagBuffer.startsWith(THINK_OPEN)) {
      const closeIdx = tagBuffer.indexOf(THINK_CLOSE);
      if (closeIdx !== -1) {
        // Tag opens and closes within buffer — skip it entirely
        const rest = tagBuffer.slice(closeIdx + THINK_CLOSE.length);
        return flushReasoningBuffer(rest, 'outside');
      }
      // Tag opened but not yet closed
      return { clean: before, remaining: { state: 'in_think', buffer: tagBuffer } };
    }

    if (tagBuffer.startsWith(REDACTED_OPEN)) {
      const closeIdx = tagBuffer.indexOf(REDACTED_CLOSE);
      if (closeIdx !== -1) {
        const rest = tagBuffer.slice(closeIdx + REDACTED_CLOSE.length);
        return flushReasoningBuffer(rest, 'outside');
      }
      return { clean: before, remaining: { state: 'in_redacted', buffer: tagBuffer } };
    }

    return { clean: before + tagBuffer, remaining: { state: 'outside', buffer: '' } };
  }

  // Inside a tag — look for close
  const tagClose = state === 'in_think' ? THINK_CLOSE : REDACTED_CLOSE;
  const closeIdx = buffer.indexOf(tagClose);
  if (closeIdx !== -1) {
    // Tag closed — skip everything up to end of close tag, process rest
    const rest = buffer.slice(closeIdx + tagClose.length);
    return flushReasoningBuffer(rest, 'outside');
  }
  // Still inside tag — buffer everything
  return { clean: '', remaining: { state, buffer } };
}

function nearestTagIndex(thinkIdx: number, redactedIdx: number): number {
  if (thinkIdx === -1) return redactedIdx;
  if (redactedIdx === -1) return thinkIdx;
  return Math.min(thinkIdx, redactedIdx);
}
