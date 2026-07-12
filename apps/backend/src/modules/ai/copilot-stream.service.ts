import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { CopilotQuotaManager } from '../../common/services/copilot-quota-manager';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { BillingService } from '../billing/billing.service';
import { ReportDataService } from '../report/report-data.service';
import { ReportExportService } from '../report/report-export.service';
import { AiUsageLogService } from './ai-usage-log.service';
import {
  buildActivities,
  COPILOT_INITIAL_STREAM_ACTIVITY,
  getStreamingActivityMeta,
} from './copilot-activity.helper';
import { CopilotConversationService } from './copilot-conversation.service';
import {
  CopilotConversationSetupService,
  type CopilotStreamMessage,
} from './copilot-conversation-setup.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import type { ToolDeps } from './copilot-tool.executor';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';
import { OpenAiService } from './openai.service';
import { isQuotaOrBillingError } from './utils/llm-error.util';
import { appendFallbackNotice, sanitizeCopilotOutput } from './utils/llm-output.util';

@Injectable()
export class CopilotStreamService {
  private readonly logger = new Logger(CopilotStreamService.name);

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly conversationService: CopilotConversationService,
    private readonly setupService: CopilotConversationSetupService,
    private readonly quotaManager: CopilotQuotaManager,
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly reportService: ReportDataService,
    private readonly exportService: ReportExportService,
    private readonly txQueryService: CopilotTransactionQueryService,
    private readonly knowledgeService: CopilotKnowledgeService,
    private readonly billingService: BillingService,
  ) {}

  private getToolDeps(): ToolDeps {
    return {
      reportService: this.reportService,
      exportService: this.exportService,
      txQueryService: this.txQueryService,
      knowledgeService: this.knowledgeService,
      billingService: this.billingService,
    };
  }

  private async finalizeChat(opts: {
    conversationId: string;
    reply: string;
    activities: ReturnType<typeof buildActivities>;
    tenantId: string;
    subMeta: { id: string; copilotQuota: number } | undefined;
    isNewConv: boolean;
    dto: CopilotStreamMessage;
    isPartial?: boolean;
  }): Promise<void> {
    void this.conversationService
      .saveAssistantMessage(
        opts.conversationId,
        opts.reply,
        opts.activities,
        opts.isPartial ?? false,
      )
      .catch(() => {});
    if (opts.isNewConv)
      this.conversationService.triggerAutoTitle(
        opts.conversationId,
        opts.dto.message,
        opts.tenantId,
      );
    await this.quotaManager.incrementAndNotify(opts.subMeta?.id, opts.tenantId);
  }

  async chat(
    user: AuthenticatedUser,
    dto: CopilotStreamMessage,
    subMeta: { id: string; copilotQuota: number } | undefined,
  ) {
    const {
      tenantId,
      isNewConv,
      useFunctionCalling,
      conversation,
      userMsg,
      history,
      financialContext,
    } = await this.setupService.prepare(user, dto);

    let reply: string;
    let activities: ReturnType<typeof buildActivities> = [];
    let meta: { activities: ReturnType<typeof buildActivities> } | undefined;

    try {
      if (useFunctionCalling) {
        const result = await this.openAiService.chatCopilotWithTools(
          tenantId,
          dto.message,
          history,
          this.getToolDeps(),
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
          financialContext,
          tenantId,
          conversation.id,
        );
      }
    } catch (err) {
      await this.conversationService.deleteMessage(userMsg.id);
      throw err;
    }

    await this.finalizeChat({
      conversationId: conversation.id,
      reply,
      activities,
      tenantId,
      subMeta,
      isNewConv,
      dto,
    });

    return { reply, meta, conversationId: conversation.id };
  }

  async streamChat(
    user: AuthenticatedUser,
    dto: CopilotStreamMessage,
    subMeta: { id: string; copilotQuota: number } | undefined,
    res: Response,
    reqOnClose: (cb: () => void) => void,
  ): Promise<void> {
    const { tenantId, isNewConv, useFunctionCalling, conversation, history, financialContext } =
      await this.setupService.prepare(user, dto);

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
      meta: { activities: ReturnType<typeof buildActivities> } | undefined,
      activities: ReturnType<typeof buildActivities>,
    ) => {
      writeEvent('done', { reply, meta, conversationId: conversation.id });
      await this.finalizeChat({
        conversationId: conversation.id,
        reply,
        activities,
        tenantId,
        subMeta,
        isNewConv,
        dto,
      });
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
          financialContext,
          tenantId,
          conversation.id,
        );
        if (!wasAborted) await finishStream(reply, undefined, []);
        return;
      }

      const resultsCapture = new Map<string, unknown>();
      const runner = this.openAiService.createCopilotRunner(
        tenantId,
        dto.message,
        history,
        this.getToolDeps(),
        resultsCapture,
        user.role,
      );

      if (!runner) {
        if (!wasAborted) {
          const reply = await this.openAiService.chatCopilot(
            dto.message,
            history,
            financialContext,
            tenantId,
            conversation.id,
          );
          await finishStream(reply, undefined, []);
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

      const rawReply = sanitizeCopilotOutput(
        (await runner.finalContent()) ?? '',
        'Xin lỗi, tôi không thể trả lời lúc này.',
      );
      const { fallback: usedFallback } = await runner.usedAdapterInfo();
      const reply = usedFallback ? appendFallbackNotice(rawReply) : rawReply;
      const activities = buildActivities(calledTools, resultsCapture);
      const meta = activities.length > 0 ? { activities } : undefined;

      if (!wasAborted) {
        const usage = await runner.totalUsage();
        if (usage) {
          this.aiUsageLogService.record({
            tenantId,
            callType: 'copilot',
            model: this.openAiService.getChatModel(),
            tokensIn: usage.prompt_tokens,
            tokensOut: usage.completion_tokens,
            conversationId: conversation.id,
          });
        }
        await finishStream(reply, meta, activities);
      }
    } catch (err) {
      if (!wasAborted) {
        if (accumulatedContent.trim()) {
          await finishStream(accumulatedContent, undefined, []);
          return;
        }

        this.logger.warn(
          isQuotaOrBillingError(err)
            ? 'Copilot runTools hết quota/credit, chuyển simple chat (MiniMax) ngay'
            : 'Copilot stream runTools failed, falling back to simple chat',
          err instanceof Error ? err.message : String(err),
        );
        const reply = await this.openAiService.chatCopilot(
          dto.message,
          history,
          financialContext,
          tenantId,
          conversation.id,
        );
        await finishStream(reply, undefined, []);
      }
    } finally {
      if (wasAborted && accumulatedContent.trim()) {
        await this.finalizeChat({
          conversationId: conversation.id,
          reply: accumulatedContent,
          activities: [],
          tenantId,
          subMeta,
          isNewConv,
          dto,
          isPartial: true,
        });
      }
      if (!res.writableEnded) res.end();
    }
  }
}
