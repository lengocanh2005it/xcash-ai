import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Subscription } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from './billing.service';

@Injectable()
export class BillingCycleService {
  private readonly logger = new Logger(BillingCycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  // Chạy lúc 2am hàng ngày, tìm subscription đã hết chu kỳ
  @Cron('0 2 * * *')
  async processEndOfCycles() {
    const now = new Date();
    const expired = await this.prisma.subscription.findMany({
      where: { status: 'active', currentCycleEnd: { lte: now } },
    });

    this.logger.log(`processEndOfCycles: found ${expired.length} expired subscription(s)`);

    for (const sub of expired) {
      await this.processCycleEnd(sub, now).catch((err: unknown) => {
        this.logger.error(`processCycleEnd failed for tenant ${sub.tenantId}`, err);
      });
    }
  }

  async processCycleEnd(sub: Subscription, now = new Date()) {
    // Tạo đơn thu phí vượt quota nếu có (Starter/Pro)
    try {
      await this.billing.createOverageOrder(sub.tenantId);
      this.logger.log(`Overage order created for tenant ${sub.tenantId}`);
    } catch {
      // Không có overage hoặc gói không áp dụng — bỏ qua
    }

    // Reset chu kỳ mới
    const newCycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        transactionUsedThisCycle: 0,
        copilotUsedThisCycle: 0,
        currentCycleStart: now,
        currentCycleEnd: newCycleEnd,
      },
    });

    this.logger.log(
      `Cycle reset for tenant ${sub.tenantId} → new end ${newCycleEnd.toISOString()}`,
    );
  }
}
