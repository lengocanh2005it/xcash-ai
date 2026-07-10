import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CopilotQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async incrementAndNotify(tenantId: string, subMeta: { id: string } | undefined): Promise<void> {
    if (!subMeta?.id) return;

    const updated = await this.prisma.subscription.update({
      where: { id: subMeta.id },
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
  }
}
