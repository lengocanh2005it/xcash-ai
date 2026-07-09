import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { AiUsageLogService } from './ai-usage-log.service';
import {
  buildActivities,
  COPILOT_INITIAL_STREAM_ACTIVITY,
  getStreamingActivityMeta,
} from './copilot-activity.helper';
import { CopilotContextService } from './copilot-context.service';
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
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly conversationService: CopilotConversationService,
    private readonly copilotToolService: CopilotToolService,
    private readonly copilotQuotaService: CopilotQuotaService,
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly copilotContextService: CopilotContextService,
    private readonly configService: ConfigService,
  ) {}

  async chat(
    user: AuthenticatedUser,
    dto: CopilotStreamMessage,
    subMeta: { id: string } | undefined,
  ) {
    const tenantId = user.tenantId!;
    const isNewConv = !dto.conversationId;
    const useFunctionCalling = this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING');

    const [conversation, financialContext] = await Promise.all([
      this.conversationService.findOrCreate(tenantId, user.id, dto.conversationId),
      useFunctionCalling
        ? Promise.resolve(undefined)
        : this.copilotContextService.getFinancialContext(tenantId, {
            name: user.name,
            role: user.role,
            businessName: user.businessName,
          }),
    ]);
    const userMsg = await this.conversationService.saveUserMessage(conversation.id, dto.message);

    const history = dto.conversationId
      ? await this.conversationService.getHistoryForContext(conversation.id, userMsg.id)
      : dto.history;

    let reply: string;
    let activities: ReturnType<typeof buildActivities> = [];
    let meta: { activities: ReturnType<typeof buildActivities> } | undefined;

    try {
      if (useFunctionCalling) {
        const result = await this.openAiService.chatCopilotWithTools(
          tenantId,
          dto.message,
          history,
          this.copilotToolService,
          conversation.id,
          user.role,
          financialContext,
        );
        reply = result.reply;
        activities = result.activities;
        meta = activities.length > 0 ? { activities } : undefined;
      } else {
        reply = await this.openAiService.chatCopilot(
          dto.message,
          history,
          financialContext!,
          tenantId,
          conversation.id,
        );
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
    const useFunctionCalling = this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING');

    const [conversation, financialContext] = await Promise.all([
      this.conversationService.findOrCreate(tenantId, user.id, dto.conversationId),
      useFunctionCalling
        ? Promise.resolve(undefined)
        : this.copilotContextService.getFinancialContext(tenantId, {
            name: user.name,
            role: user.role,
            businessName: user.businessName,
          }),
    ]);
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

    res.flushHeaders();

    if (useFunctionCalling) {
      writeEvent('activity', COPILOT_INITIAL_STREAM_ACTIVITY);
    }

    let wasAborted = false;
    let accumulatedContent = '';
    let runnerInstance: NonNullable<
      ReturnType<typeof this.openAiService.createCopilotRunner>
    > | null = null;

    reqOnClose(() => {
      wasAborted = true;
      runnerInstance?.abort();
    });

    try {
      if (!useFunctionCalling) {
        const reply = await this.openAiService.chatCopilot(
          dto.message,
          history,
          financialContext!,
          tenantId,
          conversation.id,
        );
        if (!wasAborted) {
          writeEvent('done', { reply, meta: undefined, conversationId: conversation.id });
          void this.conversationService
            .saveAssistantMessage(conversation.id, reply, [])
            .catch(() => {});
          if (isNewConv)
            this.conversationService.triggerAutoTitle(conversation.id, dto.message, tenantId);
          await this.copilotQuotaService.incrementAndNotify(tenantId, subMeta);
        }
        return;
      }

      const resultsCapture = new Map<string, unknown>();
      const runner = this.openAiService.createCopilotRunner(
        tenantId,
        dto.message,
        history,
        this.copilotToolService,
        resultsCapture,
        user.role,
      );

      if (!runner) {
        if (!wasAborted) {
          writeEvent('done', {
            reply: 'AI Copilot chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
            meta: undefined,
            conversationId: conversation.id,
          });
        }
        return;
      }

      runnerInstance = runner;
      const calledTools: string[] = [];

      runner.on('functionToolCall', (call) => {
        calledTools.push(call.name);
        const meta = getStreamingActivityMeta(call.name);
        if (meta) writeEvent('activity', meta);
      });

      runner.on('content', (delta: string) => {
        if (delta) {
          accumulatedContent += delta;
          writeEvent('delta', { content: delta });
        }
      });

      const reply = (await runner.finalContent()) ?? 'Xin lỗi, tôi không thể trả lời lúc này.';
      const activities = buildActivities(calledTools, resultsCapture);
      const meta = activities.length > 0 ? { activities } : undefined;

      if (!wasAborted) {
        const usage = await runner.totalUsage();
        this.aiUsageLogService.record({
          tenantId,
          callType: 'copilot',
          model: this.openAiService.getChatModel(),
          tokensIn: usage.prompt_tokens,
          tokensOut: usage.completion_tokens,
          conversationId: conversation.id,
        });
        writeEvent('done', { reply, meta, conversationId: conversation.id });
        void this.conversationService
          .saveAssistantMessage(conversation.id, reply, activities)
          .catch(() => {});
        if (isNewConv)
          this.conversationService.triggerAutoTitle(conversation.id, dto.message, tenantId);
        await this.copilotQuotaService.incrementAndNotify(tenantId, subMeta);
      }
    } catch {
      if (!wasAborted) {
        if (!accumulatedContent.trim()) {
          await this.conversationService.deleteMessage(userMsg.id);
        }
        writeEvent('done', {
          reply: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.',
          meta: undefined,
          conversationId: conversation.id,
        });
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
