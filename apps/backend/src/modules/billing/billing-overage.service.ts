import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isOveragePlan } from '../../common/constants/quota-policy';
import { SubscriptionQueryAdapter } from '../../common/services/subscription-query.adapter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PayosService } from './payos.service';

@Injectable()
export class BillingOverageService {
  private readonly logger = new Logger(BillingOverageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly subscriptionQuery: SubscriptionQueryAdapter,
  ) {}

  async getOverageOrders(tenantId: string) {
    const orders = await this.prisma.paymentOrder.findMany({
      where: { tenantId, orderType: 'overage', status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    return orders.map((o) => ({
      orderCode: o.orderCode,
      amount: Number(o.amount),
      createdAt: o.createdAt,
    }));
  }

  async createOverageOrder(tenantId: string) {
    const sub = await this.subscriptionQuery.findActive(tenantId);
    if (!sub) throw new NotFoundException('Không tìm thấy subscription active');

    if (!isOveragePlan(sub.plan)) {
      throw new BadRequestException('Gói hiện tại không áp dụng phí vượt quota');
    }

    const pricing = await this.prisma.planPricing.findUnique({ where: { plan: sub.plan } });
    if (!pricing?.overagePricePerTransaction) {
      throw new BadRequestException('Gói này không có cấu hình phí vượt quota');
    }

    const overageCount = await this.prisma.usageLog.count({
      where: {
        tenantId,
        metric: 'overage_transaction',
        recordedAt: { gte: sub.currentCycleStart ?? new Date(0) },
      },
    });

    if (overageCount === 0)
      throw new BadRequestException('Không có giao dịch vượt quota trong chu kỳ này');

    const existing = await this.prisma.paymentOrder.findFirst({
      where: { tenantId, orderType: 'overage', status: 'pending' },
    });

    if (existing) {
      return {
        orderCode: existing.orderCode,
        amount: Number(existing.amount),
        overageCount,
        isExisting: true,
        checkoutUrl: null,
        qrCode: null,
        isMock: false,
      };
    }

    const amount = overageCount * Number(pricing.overagePricePerTransaction);
    const orderCode = Number(String(Date.now()).slice(-9));
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    await this.prisma.paymentOrder.create({
      data: {
        tenantId,
        orderCode: String(orderCode),
        orderType: 'overage',
        targetPlan: sub.plan,
        amount,
        status: 'pending',
      },
    });

    const link = await this.payosService.createPaymentLink({
      orderCode,
      amount,
      description: `Phi vuot quota ${sub.plan}`.slice(0, 25),
      returnUrl: `${frontendUrl}/settings?tab=billing&status=success`,
      cancelUrl: `${frontendUrl}/settings?tab=billing&status=cancel`,
    });

    void this.notificationService
      .createBillingPaymentDue(tenantId, amount, overageCount)
      .catch((err: unknown) =>
        this.logger.warn(`Overage due notification failed for tenant ${tenantId}`, err),
      );

    return {
      orderCode: String(orderCode),
      amount,
      overageCount,
      isExisting: false,
      checkoutUrl: link.checkoutUrl,
      qrCode: link.qrCode,
      isMock: link.isMock,
    };
  }
}
