import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

/**
 * Rate limit riêng cho Copilot chat, theo userId (không phải tenantId).
 * TenantThrottlerGuard (global) track theo tenantId nên 1 user chat nhiều
 * có thể throttle cả tenant — guard này bổ sung giới hạn per-user.
 */
@Injectable()
export class CopilotThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request & { user?: AuthenticatedUser }): Promise<string> {
    return req.user?.id ?? req.ip ?? 'anonymous';
  }
}
