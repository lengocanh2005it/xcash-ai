import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Role } from '@xcash/shared-types';
import { CopilotAgentHarness } from './copilot-agent.harness';
import { matchReviewQueueCountIntent } from './copilot-intent-heuristic';
import { executeTool, type ToolDeps } from './copilot-tool.executor';
import { buildCopilotToolSchemas } from './copilot-tools.factory';
import type { LlmAdapter, LlmMessage } from './llm-adapter.interface';
import { OpenAiService } from './openai.service';
import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';

@Injectable()
export class CopilotAgentFactoryService {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly configService: ConfigService,
  ) {}

  private buildLlmAdapters(): LlmAdapter[] {
    const adapters: LlmAdapter[] = [];
    if (this.openAiService.client)
      adapters.push(
        new OpenAiCompatibleAdapter(
          'openai',
          this.openAiService.client,
          this.openAiService.chatModel,
        ),
      );
    if (this.openAiService.minimaxClient) {
      adapters.push(
        new OpenAiCompatibleAdapter(
          'minimax',
          this.openAiService.minimaxClient,
          this.openAiService.minimaxModel,
        ),
      );
    }
    return adapters;
  }

  buildCopilotSystemPrompt(cassoSearchEnabled = false): string {
    return this.openAiService.buildCopilotSystemPrompt(cassoSearchEnabled);
  }

  createCopilotRunner(
    tenantId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    toolDeps: ToolDeps,
    resultsCapture?: Map<string, unknown>,
    role?: Role,
  ): CopilotAgentHarness | null {
    const adapters = this.buildLlmAdapters();
    if (adapters.length === 0) return null;

    const cassoSearchEnabled =
      this.configService.get<boolean>('COPILOT_CASSO_SEARCH_ENABLED') ?? false;
    const tools = buildCopilotToolSchemas(this.configService);

    const executeToolFn = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
      const result = await executeTool(toolDeps, name, tenantId, args, role);
      resultsCapture?.set(name, result);
      return result;
    };

    const llmHistory: LlmMessage[] = history.map((h) => ({ role: h.role, content: h.content }));

    const seededToolCall = matchReviewQueueCountIntent(message)
      ? { name: 'get_review_queue_count', args: {} }
      : undefined;

    return new CopilotAgentHarness(
      adapters,
      this.buildCopilotSystemPrompt(cassoSearchEnabled),
      llmHistory,
      message,
      tools,
      executeToolFn,
      5,
      seededToolCall,
    );
  }
}
