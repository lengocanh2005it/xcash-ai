import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type SubscriptionPlan, TransactionSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PayosService } from './payos.service';

const OVERAGE_PLANS = ['starter', 'pro'] as const;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly config: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.planPricing.findMany({ orderBy: { pricePerMonth: 'asc' } });
    return plans.map((p) => ({
      plan: p.plan,
      pricePerMonth: Number(p.pricePerMonth),
      transactionQuota: p.transactionQuota,
      copilotQuota: p.copilotQuota,
      overagePricePerTransaction:
        p.overagePricePerTransaction !== null ? Number(p.overagePricePerTransaction) : null,
    }));
  }

  private async getPlanPricingOrThrow(plan: SubscriptionPlan) {
    const pricing = await this.prisma.planPricing.findUnique({ where: { plan } });
    if (!pricing) {
      throw new NotFoundException(`Không tìm thấy cấu hình gói ${plan}`);
    }
    return pricing;
  }

  async getCurrentPlan(tenantId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('Không tìm thấy gói dịch vụ');

    const planPricing = await this.prisma.planPricing.findUnique({
      where: { plan: sub.plan },
      select: { copilotQuota: true },
    });

    const [fromBank, fromImport] = await Promise.all([
      this.prisma.transaction.count({
        where: {
          tenantId,
          source: TransactionSource.cas,
          createdAt: { gte: sub.currentCycleStart, lte: sub.currentCycleEnd },
        },
      }),
      this.prisma.transaction.count({
        where: {
          tenantId,
          source: TransactionSource.import,
          createdAt: { gte: sub.currentCycleStart, lte: sub.currentCycleEnd },
        },
      }),
    ]);

    return {
      plan: sub.plan,
      pricePerMonth: Number(sub.pricePerMonth),
      transactionQuota: sub.transactionQuota,
      transactionUsed: sub.transactionUsedThisCycle,
      currentCycleStart: sub.currentCycleStart,
      currentCycleEnd: sub.currentCycleEnd,
      status: sub.status,
      copilotQuota: planPricing?.copilotQuota ?? -1,
      copilotUsed: sub.copilotUsedThisCycle,
      usageBreakdown: { fromBank, fromImport },
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

  async upgrade(tenantId: string, targetPlan: SubscriptionPlan) {
    const currentSub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });

    if (currentSub?.plan === targetPlan) {
      throw new BadRequestException('Doanh nghiệp đang sử dụng gói này');
    }

    if (currentSub) {
      const currentPricing = await this.getPlanPricingOrThrow(currentSub.plan);
      const targetPricing = await this.getPlanPricingOrThrow(targetPlan);
      if (Number(targetPricing.pricePerMonth) < Number(currentPricing.pricePerMonth)) {
        throw new BadRequestException('Không thể hạ xuống gói thấp hơn gói hiện tại');
      }
    }

    const pricing = await this.getPlanPricingOrThrow(targetPlan);
    const amount = Number(pricing.pricePerMonth);

    if (amount <= 0 && targetPlan !== 'free') {
      throw new BadRequestException('Gói dịch vụ không hợp lệ');
    }

    // orderCode phải là số nguyên dương, tránh vượt quá giới hạn PayOS
    const orderCode = Number(String(Date.now()).slice(-9));
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    const order = await this.prisma.paymentOrder.create({
      data: {
        tenantId,
        orderCode: String(orderCode),
        targetPlan,
        amount,
        status: 'pending',
      },
    });

    const link = await this.payosService.createPaymentLink({
      orderCode,
      amount,
      // PayOS giới hạn description tối đa 25 ký tự
      description: `Nang cap goi ${targetPlan}`.slice(0, 25),
      returnUrl: `${frontendUrl}/settings?tab=billing&status=success`,
      cancelUrl: `${frontendUrl}/settings?tab=billing&status=cancel`,
    });

    return {
      orderCode: order.orderCode,
      checkoutUrl: link.checkoutUrl,
      qrCode: link.qrCode,
      amount,
      isMock: link.isMock,
    };
  }

  async confirmPayment(orderCode: string, expectedTenantId?: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { orderCode },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn thanh toán');

    if (expectedTenantId && order.tenantId !== expectedTenantId) {
      throw new ForbiddenException('Không có quyền xác nhận đơn thanh toán này');
    }

    if (order.status === 'paid') return { success: true, alreadyPaid: true };

    const now = new Date();
    const { tenantId, targetPlan } = order;
    const orderType = order.orderType ?? 'upgrade';
    const amount = Number(order.amount);

    // Đơn thanh toán phí vượt quota — chỉ ghi nhận, không đổi gói
    if (orderType === 'overage') {
      await this.prisma.$transaction([
        this.prisma.paymentOrder.update({
          where: { orderCode },
          data: { status: 'paid', paidAt: now },
        }),
        this.prisma.auditLog.create({
          data: {
            tenantId,
            entityType: 'payment_order',
            entityId: orderCode,
            action: 'overage_paid',
            actor: 'system',
            afterState: { orderCode, amount, plan: targetPlan },
          },
        }),
      ]);
      void this.notificationService
        .createBillingSuccess(tenantId, 'overage', targetPlan, amount)
        .catch((err: unknown) =>
          this.logger.warn(`Billing notification failed for tenant ${tenantId}`, err),
        );
      return { success: true, alreadyPaid: false };
    }

    // Đơn nâng cấp gói — tạo subscription mới
    const pricing = await this.getPlanPricingOrThrow(targetPlan);
    const quota = pricing.transactionQuota;
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    await this.prisma.$transaction([
      this.prisma.paymentOrder.update({
        where: { orderCode },
        data: { status: 'paid', paidAt: now },
      }),
      this.prisma.subscription.updateMany({
        where: { tenantId, status: 'active' },
        data: { status: 'cancelled' },
      }),
      this.prisma.subscription.create({
        data: {
          tenantId,
          plan: targetPlan,
          pricePerMonth: amount,
          transactionQuota: quota,
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
          entityId: orderCode,
          action: 'subscription_upgraded',
          actor: 'system',
          afterState: { plan: targetPlan, amount, orderCode },
        },
      }),
    ]);

    void this.notificationService
      .createBillingSuccess(tenantId, 'upgrade', targetPlan, amount, quota)
      .catch((err: unknown) =>
        this.logger.warn(`Billing notification failed for tenant ${tenantId}`, err),
      );

    return { success: true, alreadyPaid: false };
  }

  async getPaymentHistory(
    tenantId: string,
    filters: {
      orderType?: 'upgrade' | 'overage';
      status?: 'pending' | 'paid' | 'failed' | 'expired';
      fromDate?: string;
      toDate?: string;
      limit?: number;
      page?: number;
    },
  ) {
    const { orderType, status, fromDate, toDate, limit = 20, page = 1 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(orderType ? { orderType } : {}),
      ...(status ? { status } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(`${toDate}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.paymentOrder.count({ where }),
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        orderType: o.orderType,
        targetPlan: o.targetPlan,
        amount: Number(o.amount),
        status: o.status,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCycleTransactions(
    tenantId: string,
    filters: {
      cycleStart: string;
      cycleEnd: string;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const { cycleStart, cycleEnd, search, page = 1, limit = 15 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      createdAt: {
        gte: new Date(cycleStart),
        lte: new Date(cycleEnd),
      },
      ...(search
        ? {
            OR: [
              { content: { contains: search, mode: 'insensitive' as const } },
              { transactionId: { contains: search, mode: 'insensitive' as const } },
              { senderAccount: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: {
          classification: {
            select: {
              debitAccount: true,
              creditAccount: true,
              status: true,
              confidenceScore: true,
            },
          },
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        transactionId: t.transactionId,
        amount: Number(t.amount),
        content: t.content,
        transactionDate: t.transactionDate,
        createdAt: t.createdAt,
        senderAccount: t.senderAccount,
        source: t.source,
        classification: t.classification
          ? {
              debitAccount: t.classification.debitAccount,
              creditAccount: t.classification.creditAccount,
              status: t.classification.status,
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

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
    const sub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('Không tìm thấy subscription active');

    if (!(OVERAGE_PLANS as readonly string[]).includes(sub.plan)) {
      throw new BadRequestException('Gói hiện tại không áp dụng phí vượt quota');
    }

    const pricing = await this.getPlanPricingOrThrow(sub.plan);
    if (!pricing.overagePricePerTransaction) {
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

    // Idempotency: trả lại đơn đang pending nếu đã có
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
