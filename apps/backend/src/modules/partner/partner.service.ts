import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdatePlanPricingDto } from './dto/plan-pricing.dto';

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  async listTenants() {
    const tenants = await this.prisma.tenant.findMany({
      include: {
        subscriptions: { orderBy: { startedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const monthStart = this.getMonthStart();
    const transactionCounts = await this.prisma.transaction.groupBy({
      by: ['tenantId'],
      where: { createdAt: { gte: monthStart } },
      _count: { _all: true },
    });
    const countsByTenant = new Map(transactionCounts.map((c) => [c.tenantId, c._count._all]));

    return tenants.map((tenant) => {
      const subscription = tenant.subscriptions[0];
      return {
        id: tenant.id,
        businessName: tenant.businessName,
        createdAt: tenant.createdAt,
        plan: subscription?.plan ?? null,
        status: subscription?.status ?? 'active',
        transactionsThisMonth: countsByTenant.get(tenant.id) ?? 0,
        revenuePerMonth: subscription ? Number(subscription.pricePerMonth) : 0,
      };
    });
  }

  async getTenantDetail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscriptions: { orderBy: { startedAt: 'desc' }, take: 1 },
        users: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Không tìm thấy doanh nghiệp');

    const monthStart = this.getMonthStart();
    const [transactionsThisMonth, totalTransactions, classifications] = await Promise.all([
      this.prisma.transaction.count({
        where: { tenantId, createdAt: { gte: monthStart } },
      }),
      this.prisma.transaction.count({ where: { tenantId } }),
      this.prisma.transactionClassification.findMany({
        where: { tenantId, createdAt: { gte: monthStart } },
        select: { classificationType: true },
      }),
    ]);

    const autoClassified = classifications.filter((c) => c.classificationType === 'auto').length;
    const aiAccuracy =
      classifications.length > 0 ? Math.round((autoClassified / classifications.length) * 100) : 0;

    const subscription = tenant.subscriptions[0];

    return {
      id: tenant.id,
      businessName: tenant.businessName,
      createdAt: tenant.createdAt,
      classificationThreshold: tenant.classificationThreshold,
      plan: subscription?.plan ?? null,
      status: subscription?.status ?? 'active',
      pricePerMonth: subscription ? Number(subscription.pricePerMonth) : 0,
      transactionQuota: subscription?.transactionQuota ?? 0,
      transactionUsedThisCycle: subscription?.transactionUsedThisCycle ?? 0,
      currentCycleStart: subscription?.currentCycleStart ?? null,
      currentCycleEnd: subscription?.currentCycleEnd ?? null,
      transactionsThisMonth,
      totalTransactions,
      aiAccuracy,
      members: tenant.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
      })),
    };
  }

  async suspendTenant(tenantId: string) {
    const subscription = await this.getLatestSubscription(tenantId);
    if (subscription.status === 'suspended') {
      throw new BadRequestException('Doanh nghiệp đã bị khóa');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'suspended' },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entityType: 'tenant',
        entityId: tenantId,
        action: 'tenant_suspended',
        actor: 'cas_partner',
      },
    });

    return { success: true };
  }

  async activateTenant(tenantId: string) {
    const subscription = await this.getLatestSubscription(tenantId);
    if (subscription.status === 'active') {
      throw new BadRequestException('Doanh nghiệp đang hoạt động');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'active' },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        entityType: 'tenant',
        entityId: tenantId,
        action: 'tenant_activated',
        actor: 'cas_partner',
      },
    });

    return { success: true };
  }

  async getStats() {
    const monthStart = this.getMonthStart();

    const [totalTenants, subscriptions, transactionsThisMonth, classifications] = await Promise.all(
      [
        this.prisma.tenant.count(),
        this.prisma.subscription.findMany({
          orderBy: { startedAt: 'desc' },
          distinct: ['tenantId'],
        }),
        this.prisma.transaction.count({ where: { createdAt: { gte: monthStart } } }),
        this.prisma.transactionClassification.findMany({
          where: { createdAt: { gte: monthStart } },
          select: { classificationType: true },
        }),
      ],
    );

    const suspendedCount = subscriptions.filter((s) => s.status === 'suspended').length;
    const revenueThisMonth = subscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + Number(s.pricePerMonth), 0);

    const autoClassified = classifications.filter((c) => c.classificationType === 'auto').length;
    const aiAccuracy =
      classifications.length > 0 ? Math.round((autoClassified / classifications.length) * 100) : 0;

    return {
      totalTenants,
      activeTenants: totalTenants - suspendedCount,
      suspendedTenants: suspendedCount,
      transactionsThisMonth,
      revenueThisMonth,
      aiAccuracy,
    };
  }

  async getRevenueTrend() {
    const months = Array.from({ length: 6 }, (_, i) => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const end = new Date(now.getFullYear(), now.getMonth() - (5 - i) + 1, 1);
      return { start, end, label: `${start.getMonth() + 1}/${start.getFullYear()}` };
    });

    const paidOrders = await this.prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: { gte: months[0].start } },
      select: { amount: true, paidAt: true },
    });

    return months.map(({ start, end, label }) => {
      const revenue = paidOrders
        .filter((o) => o.paidAt && o.paidAt >= start && o.paidAt < end)
        .reduce((sum, o) => sum + Number(o.amount), 0);
      return { month: label, revenue };
    });
  }

  async listPlanPricing() {
    const plans = await this.prisma.planPricing.findMany({ orderBy: { pricePerMonth: 'asc' } });
    return plans.map((p) => ({
      plan: p.plan,
      pricePerMonth: Number(p.pricePerMonth),
      transactionQuota: p.transactionQuota,
      overagePricePerTransaction:
        p.overagePricePerTransaction !== null ? Number(p.overagePricePerTransaction) : null,
      editable: p.plan !== 'free',
      updatedAt: p.updatedAt,
    }));
  }

  async updatePlanPricing(plan: SubscriptionPlan, dto: UpdatePlanPricingDto) {
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
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'plan_pricing',
        entityId: plan,
        action: 'plan_pricing_updated',
        actor: 'cas_partner',
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
      },
    });

    return {
      plan: updated.plan,
      pricePerMonth: Number(updated.pricePerMonth),
      transactionQuota: updated.transactionQuota,
      overagePricePerTransaction:
        updated.overagePricePerTransaction !== null
          ? Number(updated.overagePricePerTransaction)
          : null,
      editable: true,
      updatedAt: updated.updatedAt,
    };
  }

  private async getLatestSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
    });
    if (!subscription) throw new NotFoundException('Không tìm thấy doanh nghiệp');
    return subscription;
  }

  private getMonthStart() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
