import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentPlan(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('Không tìm thấy gói dịch vụ');

    return {
      plan: sub.plan,
      pricePerMonth: Number(sub.pricePerMonth),
      transactionQuota: sub.transactionQuota,
      transactionUsed: sub.transactionUsedThisCycle,
      currentCycleStart: sub.currentCycleStart,
      currentCycleEnd: sub.currentCycleEnd,
      status: sub.status,
    };
  }

  async getUsageHistory(tenantId: string) {
    const logs = await this.prisma.usageLog.findMany({
      where: { tenantId },
      orderBy: { recordedAt: 'desc' },
      take: 90,
    });
    return logs.map((l) => ({
      metric: l.metric,
      value: Number(l.value),
      recordedAt: l.recordedAt,
    }));
  }
}
