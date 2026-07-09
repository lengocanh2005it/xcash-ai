import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { CopilotActivity, Role } from '@xcash/shared-types';
import { buildActivities } from './copilot-activity.helper';
import type { CopilotToolService } from './copilot-tool.service';
import { buildCopilotToolDefinitions } from './copilot-tools.factory';
import { DeepSeekLlmProvider } from './llm/deepseek-llm.provider';
import { GeminiLlmProvider } from './llm/gemini-llm.provider';
import type { LlmMessage, LlmProviderAdapter, LlmToolCall } from './llm/llm-provider.interface';
import { MinimaxLlmProvider } from './llm/minimax-llm.provider';
import { OpenAiLlmProvider } from './llm/openai-llm.provider';
import { isQuotaOrBillingError } from './utils/llm-error.util';
import { sanitizeCopilotOutput } from './utils/llm-output.util';

export interface AgentRunParams {
  tenantId: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  toolService: CopilotToolService;
  systemPrompt: string;
  role?: Role;
  conversationId?: string;
  financialContext?: string;
  model?: string;
  maxRounds?: number;
  onToolCall?: (name: string) => void;
  onDelta?: (content: string) => void;
  abortSignal?: AbortSignal;
}

export interface AgentRunResult {
  reply: string;
  activities: CopilotActivity[];
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

const DEFAULT_PROVIDER_CHAIN = ['openai', 'minimax', 'deepseek', 'gemini'];

@Injectable()
export class CopilotAgentService {
  private readonly logger = new Logger(CopilotAgentService.name);
  private readonly maxRounds: number;
  private readonly providerChain: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiLlmProvider,
    private readonly minimaxProvider: MinimaxLlmProvider,
    private readonly deepseekProvider: DeepSeekLlmProvider,
    private readonly geminiProvider: GeminiLlmProvider,
  ) {
    this.maxRounds = this.configService.get<number>('COPILOT_AGENT_MAX_ROUNDS', 5);
    this.providerChain = this.parseProviderChain();
  }

  private parseProviderChain(): string[] {
    const configured = this.configService.get<string>('COPILOT_LLM_PROVIDER', '');
    if (configured) {
      return configured.split(',').map((p) => p.trim().toLowerCase());
    }
    return DEFAULT_PROVIDER_CHAIN.filter((name) => this.resolveProvider(name).isAvailable());
  }

  private resolveProvider(name: string): LlmProviderAdapter {
    switch (name) {
      case 'openai':
        return this.openAiProvider;
      case 'minimax':
        return this.minimaxProvider;
      case 'deepseek':
        return this.deepseekProvider;
      case 'gemini':
        return this.geminiProvider;
      default:
        throw new Error(`Unknown LLM provider: ${name}`);
    }
  }

  getPrimaryProvider(): LlmProviderAdapter {
    for (const name of this.providerChain) {
      const provider = this.resolveProvider(name);
      if (provider.isAvailable()) {
        return provider;
      }
    }
    throw new Error('No LLM provider available');
  }

  private getAvailableProviders(): LlmProviderAdapter[] {
    return this.providerChain
      .map((name) => this.resolveProvider(name))
      .filter((p) => p.isAvailable());
  }

  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const provider = this.getPrimaryProvider();
    return this.runWithProvider(params, provider);
  }

  private async runWithProvider(
    params: AgentRunParams,
    provider: LlmProviderAdapter,
  ): Promise<AgentRunResult> {
    const {
      tenantId,
      message,
      history,
      toolService,
      systemPrompt,
      role,
      model: requestedModel,
      maxRounds = this.maxRounds,
      onToolCall,
      abortSignal,
    } = params;

    const model = requestedModel ?? provider.getDefaultModel();

    const toolDefs = buildCopilotToolDefinitions(toolService, tenantId, role);
    const resultsCapture = new Map<string, unknown>();
    const calledTools: string[] = [];

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const totalUsage = { promptTokens: 0, completionTokens: 0 };

    for (let round = 0; round < maxRounds; round++) {
      if (abortSignal?.aborted) break;

      const response = await provider.chat({
        model,
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
        temperature: 0.3,
        maxTokens: 1024,
      });

      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
      }

      if (!response.toolCalls?.length) {
        const reply = sanitizeCopilotOutput(
          response.text ?? '',
          'Xin lỗi, tôi không thể trả lời lúc này.',
        );
        const activities = buildActivities(calledTools, resultsCapture);
        return { reply, activities, model: response.model, usage: totalUsage };
      }

      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        toolCalls: response.toolCalls,
      });

      for (const tc of response.toolCalls) {
        if (abortSignal?.aborted) break;

        const toolName = tc.name;
        calledTools.push(toolName);
        onToolCall?.(toolName);

        const args = parseToolArguments(tc);
        let result: unknown;
        try {
          result = await toolService.execute(tenantId, toolName, args, role);
          resultsCapture.set(toolName, result);
        } catch (err) {
          this.logger.warn(
            `Tool ${toolName} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          result = { error: err instanceof Error ? err.message : 'Tool execution failed' };
        }

        messages.push({
          role: 'tool',
          content: JSON.stringify(result),
          toolCallId: tc.id,
        });
      }
    }

    const finalResponse = await provider.chat({
      model,
      messages,
      temperature: 0.3,
      maxTokens: 1024,
    });

    if (finalResponse.usage) {
      totalUsage.promptTokens += finalResponse.usage.promptTokens;
      totalUsage.completionTokens += finalResponse.usage.completionTokens;
    }

    const reply = sanitizeCopilotOutput(
      finalResponse.text ?? '',
      'Xin lỗi, tôi không thể trả lời lúc này.',
    );
    const activities = buildActivities(calledTools, resultsCapture);
    return { reply, activities, model: finalResponse.model, usage: totalUsage };
  }

  async runWithFallback(params: AgentRunParams): Promise<AgentRunResult> {
    const providers = this.getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No LLM provider available');
    }

    let lastError: unknown;

    for (const provider of providers) {
      try {
        const result = await this.runWithProvider(params, provider);
        return result;
      } catch (error) {
        lastError = error;
        const isFailoverable =
          provider.isQuotaOrBillingError(error) || provider.isRetryableError(error);
        if (isFailoverable) {
          this.logger.warn(
            `${provider.providerName} failed (${isQuotaOrBillingError(error) ? 'quota/billing' : 'retryable'}), trying next provider…`,
          );
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}

function parseToolArguments(tc: LlmToolCall): Record<string, unknown> {
  try {
    const parsed = JSON.parse(tc.arguments);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
    return {};
  } catch {
    return {};
  }
}
