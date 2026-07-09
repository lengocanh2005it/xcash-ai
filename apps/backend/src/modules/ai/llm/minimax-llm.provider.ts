import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type {
  LlmChatResult,
  LlmMessage,
  LlmProviderAdapter,
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
