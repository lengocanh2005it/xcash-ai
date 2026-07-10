import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionQueryAdapter } from '../services/subscription-query.adapter';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

export const COPILOT_SUBSCRIPTION_KEY = '__copilotSubscription';

@Injectable()
export class CopilotQuotaGuard implements CanActivate {
  constructor(private readonly subscriptionQuery: SubscriptionQueryAdapter) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user: AuthenticatedUser;
        [COPILOT_SUBSCRIPTION_KEY]?: { id: string };
      }
    >();

    const user = request.user;
    if (!user?.tenantId) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const sub = await this.subscriptionQuery.findActive(user.tenantId);
    if (!sub) return true;

    // copilotQuota comes embedded in ActiveSubscription (fetched from PlanPricing
    // inside SubscriptionQueryAdapter, cached together under the same key).
    if (sub.copilotQuota === -1) {
      request[COPILOT_SUBSCRIPTION_KEY] = { id: sub.id };
      return true;
    }

    if (sub.copilotUsedThisCycle >= sub.copilotQuota) {
      throw new HttpException(
        `Bạn đã dùng hết ${sub.copilotQuota} lượt chat Copilot trong tháng này. Nâng cấp gói để tiếp tục.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    request[COPILOT_SUBSCRIPTION_KEY] = { id: sub.id };
    return true;
  }
}
