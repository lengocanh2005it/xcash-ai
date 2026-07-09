import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';
import { createAuditLog } from '../../common/util/audit-log.util';
import { invalidateTenantPlanCache } from '../../common/util/tenant-plan-cache';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import type { UpdatePlanPricingDto } from './dto/plan-pricing.dto';

@Injectable()
export class PlanPricingService {
  private readonly logger = new Logger(PlanPricingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notificationService: NotificationService,
  ) {}

  async listPlanPricing() {
    const plans = await this.prisma.planPricing.findMany({ orderBy: { pricePerMonth: 'asc' } });
    return plans.map((p) => ({
      plan: p.plan,
      pricePerMonth: Number(p.pricePerMonth),
      transactionQuota: p.transactionQuota,
      copilotQuota: p.copilotQuota,
      overagePricePerTransaction:
        p.overagePricePerTransaction !== null ? Number(p.overagePricePerTransaction) : null,
      editable: p.plan !== 'free',
      updatedAt: p.updatedAt,
    }));
  }

  async updatePlanPricing(
    plan: SubscriptionPlan,
    dto: UpdatePlanPricingDto,
    partnerUserId: string,
  ) {
    if (plan === 'free') {
      throw new BadRequestException('Không thể chỉnh giá gói Free');
    }

    const existing = await this.prisma.planPricing.findUnique({ where: { plan } });
    if (!existing) throw new NotFoundException('Không tìm thấy gói dịch vụ');

    const updated = await this.prisma.planPricing.update({
      where: { plan },
      data: {
        pricePerMonth: dto.pricePerMonth,
        transactionQuota: dto.transactionQuota,
        overagePricePerTransaction: dto.overagePricePerTransaction ?? null,
        ...(dto.copilotQuota !== undefined ? { copilotQuota: dto.copilotQuota } : {}),
      },
    });

    await createAuditLog(this.prisma, {
      entityType: 'plan_pricing',
      entityId: plan,
      action: 'plan_pricing_updated',
      actor: partnerUserId,
      beforeState: {
        pricePerMonth: Number(existing.pricePerMonth),
        transactionQuota: existing.transactionQuota,
        overagePricePerTransaction:
          existing.overagePricePerTransaction !== null
            ? Number(existing.overagePricePerTransaction)
            : null,
      },
      afterState: {
        pricePerMonth: Number(updated.pricePerMonth),
        transactionQuota: updated.transactionQuota,
        overagePricePerTransaction:
          updated.overagePricePerTransaction !== null
            ? Number(updated.overagePricePerTransaction)
            : null,
      },
    });

    return {
      plan: updated.plan,
      pricePerMonth: Number(updated.pricePerMonth),
      transactionQuota: updated.transactionQuota,
      copilotQuota: updated.copilotQuota,
      overagePricePerTransaction:
        updated.overagePricePerTransaction !== null
          ? Number(updated.overagePricePerTransaction)
          : null,
      editable: true,
      updatedAt: updated.updatedAt,
    };
  }

  async setTenantPlan(tenantId: string, targetPlan: SubscriptionPlan, partnerUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Không tìm thấy doanh nghiệp');

    const pricing = await this.prisma.planPricing.findUnique({ where: { plan: targetPlan } });
    if (!pricing) throw new NotFoundException('Gói dịch vụ không tồn tại');

    const currentSub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['active', 'suspended'] } },
      orderBy: { startedAt: 'desc' },
    });

    if (currentSub?.plan === targetPlan && currentSub?.status === 'active') {
      throw new BadRequestException('Doanh nghiệp đang sử dụng gói này');
    }

    const now = new Date();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const prevPlan = currentSub?.plan ?? null;

    await this.prisma.$transaction([
      ...(currentSub
        ? [
            this.prisma.subscription.update({
              where: { id: currentSub.id },
              data: { status: 'cancelled' },
            }),
          ]
        : []),
      this.prisma.subscription.create({
        data: {
          tenantId,
          plan: targetPlan,
          pricePerMonth: pricing.pricePerMonth,
          transactionQuota: pricing.transactionQuota,
          transactionUsedThisCycle: 0,
          status: 'active',
          startedAt: now,
          currentCycleStart: now,
          currentCycleEnd: cycleEnd,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          tenantId,
          entityType: 'subscription',
          entityId: tenantId,
          action: 'partner_set_plan',
          actor: partnerUserId,
          beforeState: { plan: prevPlan },
          afterState: { plan: targetPlan },
        },
      }),
    ]);

    void this.notificationService
      .createPlanActivatedByPartner(tenantId, targetPlan, pricing.transactionQuota)
      .catch((err: unknown) =>
        this.logger.warn(`Plan change notification failed for tenant ${tenantId}`, err),
      );

    await invalidateTenantPlanCache(this.redis, tenantId);

    return { success: true, plan: targetPlan };
  }
}
