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

const DEFAULT_MAX_CONTEXT_TOKENS = 8000;

/**
 * Rough token estimation — ~4 chars per token (conservative for mixed
 * Vietnamese + English text). No external dependency needed.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Trim history messages (oldest first) so total tokens stay under the limit.
 * System prompt and current user message are NOT included — caller handles
 * those separately.
 */
function trimHistoryToTokenLimit(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  let total = 0;
  const result: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Iterate from newest to oldest, keep as many recent messages as possible
  for (let i = history.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(history[i].content);
    if (total + msgTokens > maxTokens) break;
    total += msgTokens;
    result.unshift(history[i]);
  }

  return result;
}

@Injectable()
export class CopilotAgentService {
  private readonly logger = new Logger(CopilotAgentService.name);
  private readonly maxRounds: number;
  private readonly maxContextTokens: number;
  private readonly providerChain: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly openAiProvider: OpenAiLlmProvider,
    private readonly minimaxProvider: MinimaxLlmProvider,
    private readonly deepseekProvider: DeepSeekLlmProvider,
    private readonly geminiProvider: GeminiLlmProvider,
  ) {
    this.maxRounds = this.configService.get<number>('COPILOT_AGENT_MAX_ROUNDS', 8);
    this.maxContextTokens = this.configService.get<number>(
      'COPILOT_AGENT_MAX_CONTEXT_TOKENS',
      DEFAULT_MAX_CONTEXT_TOKENS,
    );
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

  // ── Non-streaming (used by JSON endpoint and as fallback) ─────────────────

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

    // Reserve tokens for system prompt (~3000) + user message (~200) + tool results (~1000)
    const systemTokens = estimateTokens(systemPrompt);
    const historyBudget = Math.max(1000, this.maxContextTokens - systemTokens - 1200);
    const trimmedHistory = trimHistoryToTokenLimit(history, historyBudget);
    if (trimmedHistory.length < history.length) {
      this.logger.log(
        `History trimmed: ${history.length} → ${trimmedHistory.length} messages (budget: ${historyBudget} tokens)`,
      );
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const totalUsage = { promptTokens: 0, completionTokens: 0 };
    const agentStartTime = Date.now();

    for (let round = 0; round < maxRounds; round++) {
      if (abortSignal?.aborted) break;

      const llmStart = Date.now();
      const response = await provider.chat({
        model,
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
        temperature: 0.3,
        maxTokens: 1024,
      });
      const llmMs = Date.now() - llmStart;

      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
      }

      if (!response.toolCalls?.length) {
        this.logger.log(
          `Agent loop done in ${Date.now() - agentStartTime}ms (${round + 1} rounds, ${calledTools.length} tools)`,
        );
        const reply = sanitizeCopilotOutput(
          response.text ?? '',
          'Xin lỗi, tôi không thể trả lời lúc này.',
        );
        const activities = buildActivities(calledTools, resultsCapture);
        return { reply, activities, model: response.model, usage: totalUsage };
      }

      this.logger.log(
        `Round ${round + 1}: LLM decided to call ${response.toolCalls.map((t) => t.name).join(', ')} (${llmMs}ms)`,
      );

      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        toolCalls: response.toolCalls,
      });

      if (abortSignal?.aborted) break;

      const toolsStart = Date.now();
      const toolResults = await Promise.allSettled(
        response.toolCalls.map(async (tc) => {
          const toolName = tc.name;
          calledTools.push(toolName);
          onToolCall?.(toolName);
          const args = parseToolArguments(tc);
          try {
            const result = await toolService.execute(tenantId, toolName, args, role);
            resultsCapture.set(toolName, result);
            return { toolCallId: tc.id, result };
          } catch (err) {
            this.logger.warn(
              `Tool ${toolName} failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            return {
              toolCallId: tc.id,
              result: { error: err instanceof Error ? err.message : 'Tool execution failed' },
            };
          }
        }),
      );

      for (const outcome of toolResults) {
        const { toolCallId, result } =
          outcome.status === 'fulfilled'
            ? outcome.value
            : { toolCallId: '', result: { error: 'Unexpected tool error' } };
        messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId });
      }
      this.logger.log(`Round ${round + 1} tools: ${Date.now() - toolsStart}ms`);
    }

    this.logger.warn(
      `Agent loop exhausted ${maxRounds} rounds (${Date.now() - agentStartTime}ms), falling back to final call`,
    );
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

  // ── Streaming (used by SSE endpoint) ──────────────────────────────────────

  async runWithStreaming(params: AgentRunParams): Promise<AgentRunResult> {
    const provider = this.getPrimaryProvider();
    return this.runStreamingWithProvider(params, provider);
  }

  private async runStreamingWithProvider(
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
      onDelta,
      abortSignal,
    } = params;

    const model = requestedModel ?? provider.getDefaultModel();

    const toolDefs = buildCopilotToolDefinitions(toolService, tenantId, role);
    const resultsCapture = new Map<string, unknown>();
    const calledTools: string[] = [];

    // Reserve tokens for system prompt (~3000) + user message (~200) + tool results (~1000)
    const systemTokens = estimateTokens(systemPrompt);
    const historyBudget = Math.max(1000, this.maxContextTokens - systemTokens - 1200);
    const trimmedHistory = trimHistoryToTokenLimit(history, historyBudget);
    if (trimmedHistory.length < history.length) {
      this.logger.log(
        `History trimmed: ${history.length} → ${trimmedHistory.length} messages (budget: ${historyBudget} tokens)`,
      );
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...trimmedHistory.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ];

    const totalUsage = { promptTokens: 0, completionTokens: 0 };
    const agentStartTime = Date.now();

    // ── Tool-call rounds (non-streaming) ────────────────────────────────────
    for (let round = 0; round < maxRounds; round++) {
      if (abortSignal?.aborted) break;

      const llmStart = Date.now();
      const response = await provider.chat({
        model,
        messages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        toolChoice: toolDefs.length > 0 ? 'auto' : undefined,
        temperature: 0.3,
        maxTokens: 1024,
      });
      const llmMs = Date.now() - llmStart;

      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
      }

      // No tool calls → this is the final round, switch to streaming
      if (!response.toolCalls?.length) {
        this.logger.log(
          `Agent loop done in ${Date.now() - agentStartTime}ms (${round + 1} rounds, ${calledTools.length} tools)`,
        );
        return this.streamFinalRound(
          provider,
          model,
          messages,
          totalUsage,
          calledTools,
          resultsCapture,
          onDelta,
          abortSignal,
        );
      }

      this.logger.log(
        `Round ${round + 1}: LLM decided to call ${response.toolCalls.map((t) => t.name).join(', ')} (${llmMs}ms)`,
      );

      messages.push({
        role: 'assistant',
        content: response.text ?? '',
        toolCalls: response.toolCalls,
      });

      if (abortSignal?.aborted) break;

      const toolsStart = Date.now();
      const toolResults = await Promise.allSettled(
        response.toolCalls.map(async (tc) => {
          const toolName = tc.name;
          calledTools.push(toolName);
          onToolCall?.(toolName);
          const args = parseToolArguments(tc);
          try {
            const result = await toolService.execute(tenantId, toolName, args, role);
            resultsCapture.set(toolName, result);
            return { toolCallId: tc.id, result };
          } catch (err) {
            this.logger.warn(
              `Tool ${toolName} failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            return {
              toolCallId: tc.id,
              result: { error: err instanceof Error ? err.message : 'Tool execution failed' },
            };
          }
        }),
      );

      for (const outcome of toolResults) {
        const { toolCallId, result } =
          outcome.status === 'fulfilled'
            ? outcome.value
            : { toolCallId: '', result: { error: 'Unexpected tool error' } };
        messages.push({ role: 'tool', content: JSON.stringify(result), toolCallId });
      }
      this.logger.log(`Round ${round + 1} tools: ${Date.now() - toolsStart}ms`);
    }

    this.logger.warn(
      `Agent loop exhausted ${maxRounds} rounds (${Date.now() - agentStartTime}ms), falling back to final call`,
    );
    // ── Max rounds exhausted — final call without tools (non-streaming) ─────
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

  /**
   * Final round: use chatStream() if provider supports it, otherwise fall back
   * to non-streaming. Calls onDelta for each text chunk so the SSE layer can
   * emit delta events to the frontend.
   */
  private async streamFinalRound(
    provider: LlmProviderAdapter,
    model: string,
    messages: LlmMessage[],
    totalUsage: { promptTokens: number; completionTokens: number },
    calledTools: string[],
    resultsCapture: Map<string, unknown>,
    onDelta?: (content: string) => void,
    abortSignal?: AbortSignal,
  ): Promise<AgentRunResult> {
    // If provider has no streaming support, fall back to non-streaming
    if (!provider.chatStream) {
      const response = await provider.chat({
        model,
        messages,
        temperature: 0.3,
        maxTokens: 1024,
      });

      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
      }

      // Simulate streaming by emitting the full text as a single delta
      const text = response.text ?? '';
      if (text && onDelta) onDelta(text);

      const reply = sanitizeCopilotOutput(text, 'Xin lỗi, tôi không thể trả lời lúc này.');
      const activities = buildActivities(calledTools, resultsCapture);
      return { reply, activities, model: response.model, usage: totalUsage };
    }

    // Streaming path
    let accumulated = '';
    let lastModel = model;

    const stream = provider.chatStream({
      model,
      messages,
      temperature: 0.3,
      maxTokens: 1024,
      signal: abortSignal,
    });

    for await (const chunk of stream) {
      if (abortSignal?.aborted) break;

      lastModel = chunk.model;

      if (chunk.delta) {
        accumulated += chunk.delta;
        onDelta?.(chunk.delta);
      }

      if (chunk.usage) {
        totalUsage.promptTokens += chunk.usage.promptTokens;
        totalUsage.completionTokens += chunk.usage.completionTokens;
      }

      if (chunk.done) break;
    }

    const reply = sanitizeCopilotOutput(accumulated, 'Xin lỗi, tôi không thể trả lời lúc này.');
    const activities = buildActivities(calledTools, resultsCapture);
    return { reply, activities, model: lastModel, usage: totalUsage };
  }

  // ── Fallback chain ────────────────────────────────────────────────────────

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

  async runWithStreamingFallback(params: AgentRunParams): Promise<AgentRunResult> {
    const providers = this.getAvailableProviders();
    if (providers.length === 0) {
      throw new Error('No LLM provider available');
    }

    let lastError: unknown;

    for (const provider of providers) {
      try {
        const result = await this.runStreamingWithProvider(params, provider);
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
