import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequiresPlan } from '../../common/decorators/requires-plan.decorator';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/auth.guards';
import {
  COPILOT_SUBSCRIPTION_KEY,
  CopilotQuotaGuard,
} from '../../common/guards/copilot-quota.guard';
import { PlanGuard } from '../../common/guards/plan.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CopilotContextService } from './copilot-context.service';
import { CopilotToolService } from './copilot-tool.service';
import { buildActivities, getStreamingActivityMeta, OpenAiService } from './openai.service';

class ChatMessage {
  @IsString()
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

class CopilotDto {
  @IsString()
  message: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  history: ChatMessage[];
}

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard, CopilotQuotaGuard)
export class CopilotController {
  constructor(
    private readonly openAiService: OpenAiService,
    private readonly copilotContextService: CopilotContextService,
    private readonly copilotToolService: CopilotToolService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('copilot')
  @RequiresPlan('starter')
  async chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: CopilotDto, @Req() req: Request) {
    const tenantId = user.tenantId!;

    let reply: string;
    let meta: { activities: ReturnType<typeof buildActivities> } | undefined;

    if (this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING')) {
      const result = await this.openAiService.chatCopilotWithTools(
        tenantId,
        dto.message,
        dto.history,
        this.copilotToolService,
      );
      reply = result.reply;
      meta = result.activities.length > 0 ? { activities: result.activities } : undefined;
    } else {
      const financialContext = await this.copilotContextService.getFinancialContext(tenantId);
      reply = await this.openAiService.chatCopilot(dto.message, dto.history, financialContext);
    }

    void this.incrementAndNotify(
      tenantId,
      (req as unknown as Record<string, unknown>)[COPILOT_SUBSCRIPTION_KEY] as
        | { id: string }
        | undefined,
    );

    return { reply, meta };
  }

  @Post('copilot/stream')
  @RequiresPlan('starter')
  async streamChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CopilotDto,
    @Res() res: Response,
  ) {
    const tenantId = user.tenantId!;
    const subMeta = (res.req as unknown as Record<string, unknown>)[COPILOT_SUBSCRIPTION_KEY] as
      | { id: string }
      | undefined;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const writeEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (res as unknown as { flush?: () => void }).flush?.();
    };

    try {
      if (!this.configService.get<boolean>('COPILOT_USE_FUNCTION_CALLING')) {
        const financialContext = await this.copilotContextService.getFinancialContext(tenantId);
        const reply = await this.openAiService.chatCopilot(
          dto.message,
          dto.history,
          financialContext,
        );
        writeEvent('done', { reply, meta: undefined });
        await this.incrementAndNotify(tenantId, subMeta);
        return;
      }

      const resultsCapture = new Map<string, unknown>();
      const runner = this.openAiService.createCopilotRunner(
        tenantId,
        dto.message,
        dto.history,
        this.copilotToolService,
        resultsCapture,
      );

      if (!runner) {
        writeEvent('done', {
          reply: 'AI Copilot chưa được cấu hình. Vui lòng liên hệ quản trị viên.',
          meta: undefined,
        });
        return;
      }

      const calledTools: string[] = [];

      runner.on('functionToolCall', (call) => {
        calledTools.push(call.name);
        const meta = getStreamingActivityMeta(call.name);
        if (meta) writeEvent('activity', meta);
      });

      runner.on('content', (delta: string) => {
        if (delta) writeEvent('delta', { content: delta });
      });

      const reply = (await runner.finalContent()) ?? 'Xin lỗi, tôi không thể trả lời lúc này.';
      const activities = buildActivities(calledTools, resultsCapture);
      writeEvent('done', { reply, meta: activities.length > 0 ? { activities } : undefined });

      await this.incrementAndNotify(tenantId, subMeta);
    } catch {
      writeEvent('done', { reply: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.', meta: undefined });
    } finally {
      res.end();
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
      select: {
        copilotUsedThisCycle: true,
        currentCycleStart: true,
        plan: true,
      },
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
