import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PayosService } from './payos.service';

const OVERAGE_PLANS = ['starter', 'pro'] as const;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payosService: PayosService,
    private readonly config: ConfigService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.planPricing.findMany({ orderBy: { pricePerMonth: 'asc' } });
    return plans.map((p) => ({
      plan: p.plan,
      pricePerMonth: Number(p.pricePerMonth),
      transactionQuota: p.transactionQuota,
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

  async confirmPayment(orderCode: string) {
    // biome-ignore lint/suspicious/noExplicitAny: orderType field added after Prisma client was generated
    const order = (await (this.prisma.paymentOrder.findUnique as any)({
      where: { orderCode },
    })) as {
      id: string;
      tenantId: string;
      orderCode: string;
      orderType: string;
      targetPlan: SubscriptionPlan;
      amount: { toNumber: () => number } | number;
      status: string;
      paidAt: Date | null;
    };
    if (!order) throw new NotFoundException('Không tìm thấy đơn thanh toán');

    if (order.status === 'paid') return { success: true, alreadyPaid: true };

    const now = new Date();
    const { tenantId, targetPlan, orderType } = order;
    const amount =
      typeof order.amount === 'number'
        ? order.amount
        : (order.amount as { toNumber: () => number }).toNumber();

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
      return { success: true, alreadyPaid: false };
    }

    // Đơn nâng cấp gói — tạo subscription mới
    const pricing = await this.getPlanPricingOrThrow(targetPlan);
    const quota = pricing.transactionQuota;
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

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

    return { success: true, alreadyPaid: false };
  }

  async getOverageOrders(tenantId: string) {
    // biome-ignore lint/suspicious/noExplicitAny: orderType field added after Prisma client was generated
    const orders = (await (this.prisma.paymentOrder.findMany as any)({
      where: { tenantId, orderType: 'overage', status: 'pending' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    })) as Array<{ orderCode: string; amount: { toNumber: () => number }; createdAt: Date }>;

    return orders.map((o) => ({
      orderCode: o.orderCode,
      amount: o.amount.toNumber(),
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
    // biome-ignore lint/suspicious/noExplicitAny: orderType field added after Prisma client was generated
    const existing = (await (this.prisma.paymentOrder.findFirst as any)({
      where: { tenantId, orderType: 'overage', status: 'pending' },
    })) as { orderCode: string; amount: { toNumber: () => number } } | null;

    if (existing) {
      return {
        orderCode: existing.orderCode,
        amount: existing.amount.toNumber(),
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

    // biome-ignore lint/suspicious/noExplicitAny: orderType field added after Prisma client was generated
    await (this.prisma.paymentOrder.create as any)({
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
