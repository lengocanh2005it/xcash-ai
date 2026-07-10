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
export class GeminiLlmProvider implements LlmProviderAdapter {
  readonly providerName = 'gemini';
  private readonly logger = new Logger(GeminiLlmProvider.name);
  private readonly client: OpenAI | null;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY', '');
    this.defaultModel = this.configService.get<string>('GEMINI_CHAT_MODEL', 'gemini-2.0-flash');
    this.client = apiKey
      ? new OpenAI({
          apiKey,
          baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
          maxRetries: 2,
        })
      : null;

    if (!this.client) {
      this.logger.warn('GEMINI_API_KEY chưa cấu hình — Gemini adapter disabled');
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
      throw new Error('Gemini client not configured');
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

    return {
      text: rawText || undefined,
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
      throw new Error('Gemini client not configured');
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

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      const delta = choice?.delta;

      if (delta?.content) {
        yield { delta: delta.content, model: chunk.model, done: false };
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
      return msg.includes('quota') || msg.includes('billing') || msg.includes('resource_exhausted');
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
