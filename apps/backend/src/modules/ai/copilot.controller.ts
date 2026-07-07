import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPlan } from '../../common/decorators/requires-plan.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import {
  COPILOT_SUBSCRIPTION_KEY,
  CopilotQuotaGuard,
} from '../../common/guards/copilot-quota.guard';
import { CopilotThrottlerGuard } from '../../common/guards/copilot-throttler.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { CopilotContextService } from './copilot-context.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotToolService } from './copilot-tool.service';
import {
  GetConversationQueryDto,
  ListConversationsQueryDto,
  RenameConversationDto,
} from './dto/copilot-conversation.dto';
import { buildActivities, getStreamingActivityMeta, OpenAiService } from './openai.service';

class ChatMessage {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(2000)
  content: string;
}

class CopilotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history: ChatMessage[];

  @IsOptional()
  @IsUUID()
  conversationId?: string;
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
export class CopilotController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly copilotContextService: CopilotContextService,
    private readonly copilotToolService: CopilotToolService,
    private readonly conversationService: CopilotConversationService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
  ) {}

  // ── CRUD Conversations ──────────────────────────────────────────────────────

  @Get('copilot/conversations')
  @RequiresPlan('starter')
  async listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.conversationService.listConversations(user.tenantId!, user.id, {
      limit: query.limit,
      before: query.before,
      page: query.page,
      fromDate: query.fromDate,
      toDate: query.toDate,
    });
  }

  @Get('copilot/conversations/:id')
  @RequiresPlan('starter')
  async getConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: GetConversationQueryDto,
  ) {
    return this.conversationService.getConversation(id, user.id, query.limit, query.before);
  }

  @Patch('copilot/conversations/:id')
  @RequiresPlan('starter')
  async renameConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RenameConversationDto,
  ) {
    return this.conversationService.renameConversation(id, user.id, dto.title);
  }

  @Delete('copilot/conversations/:id')
  @RequiresPlan('starter')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.conversationService.deleteConversation(id, user.id);
  }

  // ── Chat (JSON) ─────────────────────────────────────────────────────────────

  @Post('copilot')
  @RequiresPlan('starter')
  @UseGuards(CopilotQuotaGuard, CopilotThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: CopilotDto, @Req() req: Request) {
    const tenantId = user.tenantId!;
    const subMeta = (req as unknown as Record<string, unknown>)[COPILOT_SUBSCRIPTION_KEY] as
      | { id: string }
      | undefined;
    const isNewConv = !dto.conversationId;
    const useFunctionCalling = this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING');

    // Perf: chạy song song lookup conversation + pre-fetch financial context (flag=0)
    const [conversation, financialContext] = await Promise.all([
      this.conversationService.findOrCreate(tenantId, user.id, dto.conversationId),
      useFunctionCalling
        ? Promise.resolve(undefined)
        : this.copilotContextService.getFinancialContext(tenantId),
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
        );
        reply = result.reply;
        activities = result.activities;
        meta = activities.length > 0 ? { activities } : undefined;
      } else {
        reply = await this.openAiService.chatCopilot(dto.message, history, financialContext!);
      }
    } catch (err) {
      // Dangling user message — không có assistant reply để hiển thị, xóa luôn (9.9)
      await this.conversationService.deleteMessage(userMsg.id);
      throw err;
    }

    void this.conversationService
      .saveAssistantMessage(conversation.id, reply, activities)
      .catch(() => {});
    if (isNewConv) this.conversationService.triggerAutoTitle(conversation.id, dto.message);
    void this.incrementAndNotify(tenantId, subMeta);

    return { reply, meta, conversationId: conversation.id };
  }

  // ── Chat (SSE Stream) ───────────────────────────────────────────────────────

  @Post('copilot/stream')
  @RequiresPlan('starter')
  @UseGuards(CopilotQuotaGuard)
  @SkipThrottle()
  async streamChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CopilotDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tenantId = user.tenantId!;
    const subMeta = (req as unknown as Record<string, unknown>)[COPILOT_SUBSCRIPTION_KEY] as
      | { id: string }
      | undefined;
    const isNewConv = !dto.conversationId;
    const useFunctionCalling = this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING');

    // Giới hạn SSE connection đồng thời per-user (Redis, max 3) — chặn 1 user mở quá nhiều tab
    const sseKey = `copilot:sse:active:${user.id}`;
    const activeConnections = await this.redisService.client.incr(sseKey);
    await this.redisService.client.expire(sseKey, 120);
    if (activeConnections > 3) {
      await this.redisService.client.decr(sseKey);
      res.status(429).json({
        message: 'Quá nhiều cuộc trò chuyện đồng thời. Vui lòng đóng bớt tab.',
      });
      return;
    }

    try {
      await this.streamChatInternal(
        user,
        dto,
        req,
        res,
        tenantId,
        subMeta,
        isNewConv,
        useFunctionCalling,
      );
    } finally {
      await this.redisService.client.decr(sseKey);
    }
  }

  private async streamChatInternal(
    user: AuthenticatedUser,
    dto: CopilotDto,
    req: Request,
    res: Response,
    tenantId: string,
    subMeta: { id: string } | undefined,
    isNewConv: boolean,
    useFunctionCalling: boolean | undefined,
  ): Promise<void> {
    // Setup conversation + save user message BEFORE flushing SSE headers
    // so that errors (e.g. 404 invalid conversationId) return proper HTTP codes
    // Perf: chạy song song lookup conversation + pre-fetch financial context (flag=0)
    const [conversation, financialContext] = await Promise.all([
      this.conversationService.findOrCreate(tenantId, user.id, dto.conversationId),
      useFunctionCalling
        ? Promise.resolve(undefined)
        : this.copilotContextService.getFinancialContext(tenantId),
    ]);
    const userMsg = await this.conversationService.saveUserMessage(conversation.id, dto.message);

    const history = dto.conversationId
      ? await this.conversationService.getHistoryForContext(conversation.id, userMsg.id)
      : dto.history;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as unknown as { flush?: () => void }).flush?.();
    };

    // Phase 4: abort tracking — set up AFTER flushHeaders so pre-flush closes don't trigger
    let wasAborted = false;
    let accumulatedContent = '';
    let runnerInstance: NonNullable<
      ReturnType<typeof this.openAiService.createCopilotRunner>
    > | null = null;

    req.on('close', () => {
      wasAborted = true;
      runnerInstance?.abort();
    });

    try {
      if (!useFunctionCalling) {
        const reply = await this.openAiService.chatCopilot(dto.message, history, financialContext!);
        if (!wasAborted) {
          writeEvent('done', { reply, meta: undefined, conversationId: conversation.id });
          void this.conversationService
            .saveAssistantMessage(conversation.id, reply, [])
            .catch(() => {});
          if (isNewConv) this.conversationService.triggerAutoTitle(conversation.id, dto.message);
          await this.incrementAndNotify(tenantId, subMeta);
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
        writeEvent('done', { reply, meta, conversationId: conversation.id });
        void this.conversationService
          .saveAssistantMessage(conversation.id, reply, activities)
          .catch(() => {});
        if (isNewConv) this.conversationService.triggerAutoTitle(conversation.id, dto.message);
        await this.incrementAndNotify(tenantId, subMeta);
      }
    } catch {
      if (!wasAborted) {
        // Lỗi thật (không phải abort) và chưa có nội dung nào — xóa dangling user message (9.9)
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
      // Save partial assistant message if aborted mid-stream with content
      if (wasAborted && accumulatedContent.trim()) {
        void this.conversationService
          .saveAssistantMessage(conversation.id, accumulatedContent, [], true)
          .catch(() => {});
        if (isNewConv) this.conversationService.triggerAutoTitle(conversation.id, dto.message);
      }
      if (!res.writableEnded) res.end();
    }
  }

  private async incrementAndNotify(
    tenantId: string,
    subMeta: { id: string } | undefined,
  ): Promise<void> {
    if (!subMeta?.id) return;

    const updated = await this.prisma.subscription.update({
      where: { id: subMeta.id },
      data: { copilotUsedThisCycle: { increment: 1 } },
      select: { copilotUsedThisCycle: true, currentCycleStart: true, plan: true },
    });

    const planPricing = await this.prisma.planPricing.findUnique({
      where: { plan: updated.plan },
      select: { copilotQuota: true },
    });

    const quota = planPricing?.copilotQuota ?? -1;

    void this.notificationService
      .checkCopilotQuotaNotifications(
        tenantId,
        updated.copilotUsedThisCycle,
        quota,
        updated.currentCycleStart,
      )
      .catch(() => {});
  }
}
