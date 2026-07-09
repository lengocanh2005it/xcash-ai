import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { NotificationService } from '../../modules/notification/notification.service';
import { isOveragePlan, QUOTA_WARNING_RATIO } from '../constants/quota-policy';

export interface QuotaNotificationParams {
  tenantId: string;
  oldUsed: number;
  quota: number;
  plan: SubscriptionPlan;
  overagePricePerTransaction: number | null;
  cycleStart: Date;
  added: number;
}

@Injectable()
export class QuotaNotificationService {
  private readonly logger = new Logger(QuotaNotificationService.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Check quota thresholds and dispatch notifications.
   * Fire-and-forget: errors are logged but never thrown.
   */
  async checkAndNotify(params: QuotaNotificationParams): Promise<void> {
    const { tenantId, oldUsed, quota, plan, overagePricePerTransaction, cycleStart, added } =
      params;

    const newUsed = oldUsed + added;
    const warningThreshold = Math.ceil(quota * QUOTA_WARNING_RATIO);

    try {
      if (oldUsed < warningThreshold && newUsed >= warningThreshold) {
        await this.notificationService.createQuotaWarning(tenantId, newUsed, quota, cycleStart);
      }

      if (oldUsed < quota && newUsed >= quota) {
        await this.notificationService.createQuotaExceeded(tenantId, quota, cycleStart);
      }

      if (newUsed > quota && isOveragePlan(plan)) {
        const price = overagePricePerTransaction ?? 0;
        if (price > 0) {
          await this.notificationService.createOverageStarted(tenantId, price, cycleStart);
        }
      }
    } catch (err) {
      this.logger.warn(`Quota notification failed for tenant ${tenantId}`, err);
    }
  }
}
