import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SubscriptionPlan } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRED_PLAN_KEY } from '../decorators/requires-plan.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { meetsPlan, PLAN_LABEL } from '../util/plan.util';

/**
 * Chặn truy cập tính năng theo gói dịch vụ. Đọc gói active mới nhất từ DB
 * (không tin JWT) để tránh token cũ vượt quyền, so với @RequiresPlan.
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<SubscriptionPlan>(REQUIRED_PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;
    if (!user?.tenantId) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: user.tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
      select: { plan: true },
    });

    if (!meetsPlan(subscription?.plan, requiredPlan)) {
      throw new ForbiddenException(
        `Tính năng này yêu cầu gói ${PLAN_LABEL[requiredPlan]} trở lên. Vui lòng nâng cấp gói dịch vụ.`,
      );
    }

    return true;
  }
}
