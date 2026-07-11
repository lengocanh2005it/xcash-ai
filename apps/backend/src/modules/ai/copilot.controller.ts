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
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
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
import { RedisService } from '../../redis/redis.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { CopilotStreamService } from './copilot-stream.service';
import { CopilotDto } from './dto/copilot.dto';
import {
  GetConversationQueryDto,
  ListConversationsQueryDto,
  RenameConversationDto,
} from './dto/copilot-conversation.dto';

@ApiTags('ai')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
export class CopilotController {
  constructor(
    private readonly copilotStreamService: CopilotStreamService,
    private readonly conversationService: CopilotConversationService,
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
    const subMeta = (req as unknown as Record<string, unknown>)[COPILOT_SUBSCRIPTION_KEY] as
      | { id: string }
      | undefined;

    return this.copilotStreamService.chat(user, dto, subMeta);
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
    const subMeta = (req as unknown as Record<string, unknown>)[COPILOT_SUBSCRIPTION_KEY] as
      | { id: string }
      | undefined;

    const sseKey = `copilot:sse:active:${user.id}`;
    const activeConnections = await this.redisService.incr(sseKey);
    await this.redisService.expire(sseKey, 120);
    if (activeConnections > 3) {
      await this.redisService.decr(sseKey);
      res.status(429).json({
        message: 'Quá nhiều cuộc trò chuyện đồng thời. Vui lòng đóng bớt tab.',
      });
      return;
    }

    try {
      await this.copilotStreamService.streamChat(user, dto, subMeta, res, (cb) =>
        req.on('close', cb),
      );
    } finally {
      await this.redisService.decr(sseKey);
    }
  }
}
