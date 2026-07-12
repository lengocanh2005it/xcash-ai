import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../../modules/notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Encapsulates copilot quota increment + notification after a successful chat.
 * Lives in common/services so both AI and (future) other modules can inject it.
 *
 * Design (Option B from grill): caller passes subscriptionId + copilotQuota.
 * This service owns the Prisma update + planPricing read + notification dispatch.
 */
@Injectable()
export class CopilotQuotaManager {
  private readonly logger = new Logger(CopilotQuotaManager.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Increment copilotUsedThisCycle and fire quota notifications (fire-and-forget).
   * No-op when subscriptionId is undefined (e.g., free plan with no subscription).
   */
  async incrementAndNotify(subscriptionId: string | undefined, tenantId: string): Promise<void> {
    if (!subscriptionId) return;

    try {
      const updated = await this.prisma.subscription.update({
        where: { id: subscriptionId },
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
    } catch (err) {
      this.logger.warn(
        `Copilot quota increment failed for tenant ${tenantId}`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
}
