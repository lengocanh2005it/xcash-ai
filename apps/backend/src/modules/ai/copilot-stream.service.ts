import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CopilotActivity } from '@xcash/shared-types';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AiUsageLogService } from './ai-usage-log.service';
import {
  COPILOT_INITIAL_STREAM_ACTIVITY,
  getStreamingActivityMeta,
} from './copilot-activity.helper';
import { CopilotAgentService } from './copilot-agent.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotQuotaService } from './copilot-quota.service';
import { CopilotToolService } from './copilot-tool.service';
import { OpenAiService } from './openai.service';

interface CopilotStreamMessage {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  conversationId?: string;
}

@Injectable()
export class CopilotStreamService {
  private readonly logger = new Logger(CopilotStreamService.name);

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly agentService: CopilotAgentService,
    private readonly conversationService: CopilotConversationService,
    private readonly copilotToolService: CopilotToolService,
    private readonly copilotQuotaService: CopilotQuotaService,
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly configService: ConfigService,
  ) {}

  async chat(
    user: AuthenticatedUser,
    dto: CopilotStreamMessage,
    subMeta: { id: string } | undefined,
  ) {
    const tenantId = user.tenantId!;
    const isNewConv = !dto.conversationId;

    const conversation = await this.conversationService.findOrCreate(
      tenantId,
      user.id,
      dto.conversationId,
    );

    const userMsg = await this.conversationService.saveUserMessage(conversation.id, dto.message);

    const history = dto.conversationId
      ? await this.conversationService.getHistoryForContext(conversation.id, userMsg.id)
      : dto.history;

    let reply: string;
    let activities: CopilotActivity[] = [];
    let meta: { activities: CopilotActivity[] } | undefined;

    try {
      const result = await this.agentService.runWithFallback({
        tenantId,
        message: dto.message,
        history,
        toolService: this.copilotToolService,
        systemPrompt: this.openAiService.buildCopilotSystemPrompt(
          this.configService.get<boolean>('COPILOT_CASSO_SEARCH_ENABLED') ?? false,
        ),
        role: user.role,
        conversationId: conversation.id,
      });
      reply = result.reply;
      activities = result.activities;
      meta = activities.length > 0 ? { activities } : undefined;

      if (result.usage) {
        this.aiUsageLogService.record({
          tenantId,
          callType: 'copilot',
          model: result.model,
          tokensIn: result.usage.promptTokens,
          tokensOut: result.usage.completionTokens,
          conversationId: conversation.id,
        });
      }
    } catch (err) {
      await this.conversationService.deleteMessage(userMsg.id);
      throw err;
    }

    void this.conversationService
      .saveAssistantMessage(conversation.id, reply, activities)
      .catch(() => {});
    if (isNewConv)
      this.conversationService.triggerAutoTitle(conversation.id, dto.message, tenantId);
    void this.copilotQuotaService.incrementAndNotify(tenantId, subMeta);

    return { reply, meta, conversationId: conversation.id };
  }

  async streamChat(
    user: AuthenticatedUser,
    dto: CopilotStreamMessage,
    subMeta: { id: string } | undefined,
    res: Response,
    reqOnClose: (cb: () => void) => void,
  ): Promise<void> {
    const tenantId = user.tenantId!;
    const isNewConv = !dto.conversationId;

    // When function calling is ON, tools fetch data on-demand — skip preload
    const conversation = await this.conversationService.findOrCreate(
      tenantId,
      user.id,
      dto.conversationId,
    );

    const userMsg = await this.conversationService.saveUserMessage(conversation.id, dto.message);

    const history = dto.conversationId
      ? await this.conversationService.getHistoryForContext(conversation.id, userMsg.id)
      : dto.history;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as unknown as { flush?: () => void }).flush?.();
    };

    const finishStream = async (
      reply: string,
      meta: { activities: CopilotActivity[] } | undefined,
      activities: CopilotActivity[],
    ) => {
      writeEvent('done', { reply, meta, conversationId: conversation.id });
      void this.conversationService
        .saveAssistantMessage(conversation.id, reply, activities)
        .catch(() => {});
      if (isNewConv)
        this.conversationService.triggerAutoTitle(conversation.id, dto.message, tenantId);
      await this.copilotQuotaService.incrementAndNotify(tenantId, subMeta);
    };

    res.flushHeaders();

    writeEvent('activity', COPILOT_INITIAL_STREAM_ACTIVITY);

    let wasAborted = false;
    let accumulatedContent = '';

    const abortController = new AbortController();
    reqOnClose(() => {
      wasAborted = true;
      abortController.abort();
    });

    try {
      const result = await this.agentService.runWithStreamingFallback({
        tenantId,
        message: dto.message,
        history,
        toolService: this.copilotToolService,
        systemPrompt: this.openAiService.buildCopilotSystemPrompt(
          this.configService.get<boolean>('COPILOT_CASSO_SEARCH_ENABLED') ?? false,
        ),
        role: user.role,
        conversationId: conversation.id,
        onToolCall: (name) => {
          const meta = getStreamingActivityMeta(name);
          if (meta) writeEvent('activity', meta);
        },
        onDelta: (delta) => {
          if (delta) {
            accumulatedContent += delta;
            writeEvent('delta', { content: delta });
          }
        },
        abortSignal: abortController.signal,
      });

      if (!wasAborted) {
        if (result.usage) {
          this.aiUsageLogService.record({
            tenantId,
            callType: 'copilot',
            model: result.model,
            tokensIn: result.usage.promptTokens,
            tokensOut: result.usage.completionTokens,
            conversationId: conversation.id,
          });
        }
        const meta = result.activities.length > 0 ? { activities: result.activities } : undefined;
        await finishStream(result.reply, meta, result.activities);
      }
    } catch (err) {
      if (!wasAborted) {
        if (accumulatedContent.trim()) {
          await finishStream(accumulatedContent, undefined, []);
          return;
        }

        this.logger.warn('Copilot agent failed', err instanceof Error ? err.message : String(err));
        // Last resort: non-streaming fallback (no tools)
        try {
          const reply = await this.openAiService.chatCopilot(
            dto.message,
            history,
            '',
            tenantId,
            conversation.id,
          );
          await finishStream(reply, undefined, []);
        } catch {
          await finishStream('Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.', undefined, []);
        }
      }
    } finally {
      if (wasAborted && accumulatedContent.trim()) {
        void this.conversationService
          .saveAssistantMessage(conversation.id, accumulatedContent, [], true)
          .catch(() => {});
        if (isNewConv)
          this.conversationService.triggerAutoTitle(conversation.id, dto.message, tenantId);
      }
      if (!res.writableEnded) res.end();
    }
  }
}
