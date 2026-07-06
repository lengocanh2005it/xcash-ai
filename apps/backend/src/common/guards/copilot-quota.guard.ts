import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

export const COPILOT_SUBSCRIPTION_KEY = '__copilotSubscription';

@Injectable()
export class CopilotQuotaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: user.tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
      select: { id: true, plan: true, copilotUsedThisCycle: true },
    });

    if (!subscription) return true;

    const planPricing = await this.prisma.planPricing.findUnique({
      where: { plan: subscription.plan },
      select: { copilotQuota: true },
    });

    const quota = planPricing?.copilotQuota ?? -1;

    if (quota === -1) {
      request[COPILOT_SUBSCRIPTION_KEY] = { id: subscription.id };
      return true;
    }

    if (subscription.copilotUsedThisCycle >= quota) {
      throw new HttpException(
        `Bạn đã dùng hết ${quota} lượt chat Copilot trong tháng này. Nâng cấp gói để tiếp tục.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    request[COPILOT_SUBSCRIPTION_KEY] = { id: subscription.id };
    return true;
  }
}
