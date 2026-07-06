import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

const OVERAGE_PLANS = [SubscriptionPlan.starter, SubscriptionPlan.pro] as const;
const QUOTA_WARNING_RATIO = 0.8;

@Injectable()
export class TransactionQuotaService {
  private readonly logger = new Logger(TransactionQuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async getActiveSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
    });
    return sub;
  }

  /**
   * Check if batch import is allowed. Free plan: throw when over quota.
   * Starter/Pro: allowed with overage. Enterprise: always allowed.
   * Returns the subscription for downstream use.
   */
  async assertCanAcceptBatch(
    tenantId: string,
    rowCount: number,
  ): Promise<{
    subscription: NonNullable<Awaited<ReturnType<typeof this.getActiveSubscription>>>;
    willExceedQuota: boolean;
    remaining: number;
  }> {
    const subscription = await this.getActiveSubscription(tenantId);
    if (!subscription) {
      throw new ForbiddenException('Không tìm thấy subscription active cho tenant');
    }

    const remaining = Math.max(
      0,
      subscription.transactionQuota - subscription.transactionUsedThisCycle,
    );
    const willExceedQuota = rowCount > remaining;

    if (willExceedQuota && subscription.plan === SubscriptionPlan.free) {
      throw new ForbiddenException(
        `Đã hết quota tháng này (còn ${remaining} slot). Vui lòng nâng cấp gói hoặc giảm số dòng import.`,
      );
    }

    return { subscription, willExceedQuota, remaining };
  }

  /**
   * Increment quota usage inside a Prisma transaction (tx).
   * Call this once per imported transaction row, inside prisma.$transaction.
   */
  async incrementUsageInTx(
    tx: Omit<
      PrismaService,
      '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
    >,
    subscription: {
      id: string;
      transactionUsedThisCycle: number;
      transactionQuota: number;
      plan: SubscriptionPlan;
      overagePricePerTransaction: Prisma.Decimal | null;
      currentCycleStart: Date;
    },
    tenantId: string,
    count = 1,
  ): Promise<void> {
    const oldUsed = subscription.transactionUsedThisCycle;
    const quota = subscription.transactionQuota;

    await tx.subscription.update({
      where: { id: subscription.id },
      data: { transactionUsedThisCycle: { increment: count } },
    });

    if ((OVERAGE_PLANS as readonly string[]).includes(subscription.plan)) {
      const overCount = Math.max(0, oldUsed + count - quota);
      if (overCount > 0) {
        await tx.usageLog.create({
          data: {
            tenantId,
            metric: 'overage_transaction',
            value: new Prisma.Decimal(overCount),
          },
        });
      }
    }
  }

  /**
   * Fire quota notifications after a batch import.
   * Non-blocking: errors are logged but not thrown.
   */
  async notifyAfterBatch(
    subscription: {
      transactionUsedThisCycle: number;
      transactionQuota: number;
      plan: SubscriptionPlan;
      overagePricePerTransaction: Prisma.Decimal | null;
      currentCycleStart: Date;
    },
    tenantId: string,
    imported: number,
  ): Promise<void> {
    const oldUsed = subscription.transactionUsedThisCycle;
    const quota = subscription.transactionQuota;
    const newUsed = oldUsed + imported;
    const cycleStart = subscription.currentCycleStart;
    const warningThreshold = Math.ceil(quota * QUOTA_WARNING_RATIO);

    try {
      if (oldUsed < warningThreshold && newUsed >= warningThreshold) {
        await this.notificationService.createQuotaWarning(tenantId, newUsed, quota, cycleStart);
      }
      if (oldUsed < quota && newUsed >= quota) {
        await this.notificationService.createQuotaExceeded(tenantId, quota, cycleStart);
      }
      if (newUsed > quota && (OVERAGE_PLANS as readonly string[]).includes(subscription.plan)) {
        const price = subscription.overagePricePerTransaction
          ? Number(subscription.overagePricePerTransaction)
          : 0;
        if (price > 0) {
          await this.notificationService.createOverageStarted(tenantId, price, cycleStart);
        }
      }
    } catch (err) {
      this.logger.warn(`Quota notification failed for tenant ${tenantId}`, err);
    }
  }
}
