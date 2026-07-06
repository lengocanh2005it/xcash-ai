import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { PaymentOrderStatus, Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import type { UpdatePlanPricingDto } from './dto/plan-pricing.dto';

@Injectable()
export class PartnerService {
  private readonly logger = new Logger(PartnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async listTenants(params?: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }) {
    const search = params?.search?.trim();
    const statusFilter = params?.status && params.status !== 'all' ? params.status : undefined;
    const planFilter =
      params?.plan && params.plan !== 'all' ? (params.plan as SubscriptionPlan) : undefined;
    const page = Math.max(1, Math.trunc(params?.page ?? 1));
    const limit = params?.limit ? Math.min(100, Math.max(1, Math.trunc(params.limit))) : null;

    const tenants = await this.prisma.tenant.findMany({
      where: {
        ...(search ? { businessName: { contains: search, mode: 'insensitive' } } : {}),
      },
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

    const all = tenants
      .map((tenant) => {
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
      })
      .filter((tenant) => {
        if (statusFilter && tenant.status !== statusFilter) {
          return false;
        }
        if (planFilter && tenant.plan !== planFilter) {
          return false;
        }
        return true;
      });

    const total = all.length;
    if (!limit) {
      return { items: all, page: 1, limit: total, total, totalPages: 1 };
    }

    return {
      items: all.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
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
      ownerName: tenant.ownerName,
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

  async suspendTenant(tenantId: string, partnerUserId: string) {
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
        actor: partnerUserId,
      },
    });

    void this.notificationService
      .createTenantSuspended(tenantId)
      .catch((err: unknown) =>
        this.logger.warn(`Suspend notification failed for tenant ${tenantId}`, err),
      );

    return { success: true };
  }

  async activateTenant(tenantId: string, partnerUserId: string) {
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
        actor: partnerUserId,
      },
    });

    return { success: true };
  }

  async getStats(params?: { fromDate?: string; toDate?: string }) {
    const period = this.resolveStatsPeriod(params?.fromDate, params?.toDate);

    const [totalTenants, subscriptions, transactionsThisMonth, classifications] = await Promise.all(
      [
        this.prisma.tenant.count(),
        this.prisma.subscription.findMany({
          orderBy: { startedAt: 'desc' },
          distinct: ['tenantId'],
        }),
        this.prisma.transaction.count({
          where: { createdAt: { gte: period.start, lte: period.end } },
        }),
        this.prisma.transactionClassification.findMany({
          where: { createdAt: { gte: period.start, lte: period.end } },
          select: { classificationType: true },
        }),
      ],
    );

    const suspendedCount = subscriptions.filter((s) => s.status === 'suspended').length;
    const activeSubscriptions = subscriptions.filter((s) => s.status === 'active');
    const recurringRevenuePerMonth = activeSubscriptions.reduce(
      (sum, s) => sum + Number(s.pricePerMonth),
      0,
    );

    const paidOrdersAgg = await this.prisma.paymentOrder.aggregate({
      where: {
        status: 'paid',
        paidAt: { gte: period.start, lte: period.end },
      },
      _sum: { amount: true },
    });
    const paidRevenueThisMonth = Number(paidOrdersAgg._sum.amount ?? 0);

    const autoClassified = classifications.filter((c) => c.classificationType === 'auto').length;
    const aiAccuracy =
      classifications.length > 0 ? Math.round((autoClassified / classifications.length) * 100) : 0;

    return {
      totalTenants,
      activeTenants: totalTenants - suspendedCount,
      suspendedTenants: suspendedCount,
      transactionsThisMonth,
      recurringRevenuePerMonth,
      paidRevenueThisMonth,
      aiAccuracy,
    };
  }

  async getRevenueTrend(params?: { fromDate?: string; toDate?: string }) {
    const months = this.resolveTrendMonths(params?.fromDate, params?.toDate);
    if (months.length === 0) return [];

    const paidOrders = await this.prisma.paymentOrder.findMany({
      where: { status: 'paid', paidAt: { gte: months[0].start, lte: months.at(-1)!.end } },
      select: { amount: true, paidAt: true, targetPlan: true },
    });

    return months.map(({ start, end, label }) => {
      const inMonth = paidOrders.filter((o) => o.paidAt && o.paidAt >= start && o.paidAt <= end);
      const byPlan = { free: 0, starter: 0, pro: 0, enterprise: 0 };
      let revenue = 0;
      for (const o of inMonth) {
        const amount = Number(o.amount);
        revenue += amount;
        if (o.targetPlan in byPlan) {
          byPlan[o.targetPlan as keyof typeof byPlan] += amount;
        }
      }
      return { month: label, revenue, ...byPlan };
    });
  }

  async listPayments(params: {
    page?: number;
    limit?: number;
    status?: string;
    plan?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Math.trunc(params.limit ?? 20)));

    const where: Prisma.PaymentOrderWhereInput = {};
    if (params.status && params.status !== 'all') {
      where.status = params.status as PaymentOrderStatus;
    }
    if (params.plan && params.plan !== 'all') {
      where.targetPlan = params.plan as SubscriptionPlan;
    }

    // Lọc theo ngày tạo đơn (createdAt) — khớp với thứ tự sắp xếp mặc định.
    const createdAt: Prisma.DateTimeFilter = {};
    if (params.fromDate) {
      const from = new Date(params.fromDate);
      if (!Number.isNaN(from.getTime())) createdAt.gte = from;
    }
    if (params.toDate) {
      const to = new Date(params.toDate);
      if (!Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        createdAt.lte = to;
      }
    }
    if (createdAt.gte || createdAt.lte) {
      where.createdAt = createdAt;
    }

    const search = params.search?.trim();
    if (search) {
      const matchingTenants = await this.prisma.tenant.findMany({
        where: { businessName: { contains: search, mode: 'insensitive' } },
        select: { id: true },
      });
      where.OR = [
        { orderCode: { contains: search, mode: 'insensitive' } },
        { tenantId: { in: matchingTenants.map((t) => t.id) } },
      ];
    }

    const [total, orders, summaryAll, summaryPaid] = await Promise.all([
      this.prisma.paymentOrder.count({ where }),
      this.prisma.paymentOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentOrder.count({ where }),
      this.prisma.paymentOrder.aggregate({
        where: { AND: [where, { status: 'paid' }] },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const tenantIds = [...new Set(orders.map((o) => o.tenantId))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, businessName: true },
    });
    const nameByTenant = new Map(tenants.map((t) => [t.id, t.businessName]));

    return {
      items: orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        tenantId: o.tenantId,
        businessName: nameByTenant.get(o.tenantId) ?? '—',
        orderType: o.orderType,
        targetPlan: o.targetPlan,
        amount: Number(o.amount),
        status: o.status,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      summary: {
        totalCount: summaryAll,
        paidCount: summaryPaid._count._all,
        totalPaid: Number(summaryPaid._sum.amount ?? 0),
      },
    };
  }

  async listPlanPricing() {
    const plans = await this.prisma.planPricing.findMany({ orderBy: { pricePerMonth: 'asc' } });
    return plans.map((p) => ({
      plan: p.plan,
      pricePerMonth: Number(p.pricePerMonth),
      transactionQuota: p.transactionQuota,
      copilotQuota: p.copilotQuota,
      overagePricePerTransaction:
        p.overagePricePerTransaction !== null ? Number(p.overagePricePerTransaction) : null,
      editable: p.plan !== 'free',
      updatedAt: p.updatedAt,
    }));
  }

  async updatePlanPricing(
    plan: SubscriptionPlan,
    dto: UpdatePlanPricingDto,
    partnerUserId: string,
  ) {
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
        ...(dto.copilotQuota !== undefined ? { copilotQuota: dto.copilotQuota } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        entityType: 'plan_pricing',
        entityId: plan,
        action: 'plan_pricing_updated',
        actor: partnerUserId,
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
      copilotQuota: updated.copilotQuota,
      overagePricePerTransaction:
        updated.overagePricePerTransaction !== null
          ? Number(updated.overagePricePerTransaction)
          : null,
      editable: true,
      updatedAt: updated.updatedAt,
    };
  }

  async setTenantPlan(tenantId: string, targetPlan: SubscriptionPlan, partnerUserId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Không tìm thấy doanh nghiệp');

    const pricing = await this.prisma.planPricing.findUnique({ where: { plan: targetPlan } });
    if (!pricing) throw new NotFoundException('Gói dịch vụ không tồn tại');

    const currentSub = await this.prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['active', 'suspended'] } },
      orderBy: { startedAt: 'desc' },
    });

    if (currentSub?.plan === targetPlan && currentSub?.status === 'active') {
      throw new BadRequestException('Doanh nghiệp đang sử dụng gói này');
    }

    const now = new Date();
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const prevPlan = currentSub?.plan ?? null;

    await this.prisma.$transaction([
      ...(currentSub
        ? [
            this.prisma.subscription.update({
              where: { id: currentSub.id },
              data: { status: 'cancelled' },
            }),
          ]
        : []),
      this.prisma.subscription.create({
        data: {
          tenantId,
          plan: targetPlan,
          pricePerMonth: pricing.pricePerMonth,
          transactionQuota: pricing.transactionQuota,
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
          entityId: tenantId,
          action: 'partner_set_plan',
          actor: partnerUserId,
          beforeState: { plan: prevPlan },
          afterState: { plan: targetPlan },
        },
      }),
    ]);

    void this.notificationService
      .createPlanActivatedByPartner(tenantId, targetPlan, pricing.transactionQuota)
      .catch((err: unknown) =>
        this.logger.warn(`Plan change notification failed for tenant ${tenantId}`, err),
      );

    return { success: true, plan: targetPlan };
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

  /** Mặc định: tháng hiện tại. Có fromDate/toDate: lọc theo khoảng (end inclusive đến 23:59:59). */
  private resolveStatsPeriod(fromDate?: string, toDate?: string) {
    const range = this.parseDateRange(fromDate, toDate);
    if (range) return range;

    const monthStart = this.getMonthStart();
    const monthEnd = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return { start: monthStart, end: monthEnd };
  }

  /** Mặc định: 6 tháng gần nhất. Có fromDate/toDate: bucket theo tháng trong khoảng (tối đa 24). */
  private resolveTrendMonths(fromDate?: string, toDate?: string) {
    const range = this.parseDateRange(fromDate, toDate);
    if (range) return this.buildMonthBuckets(range.start, range.end);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return this.buildMonthBuckets(start, end);
  }

  private parseDateRange(fromDate?: string, toDate?: string) {
    if (!fromDate && !toDate) return null;

    let start: Date | null = null;
    let end: Date | null = null;

    if (fromDate) {
      start = new Date(fromDate);
      if (Number.isNaN(start.getTime())) return null;
      start.setHours(0, 0, 0, 0);
    }
    if (toDate) {
      end = new Date(toDate);
      if (Number.isNaN(end.getTime())) return null;
      end.setHours(23, 59, 59, 999);
    }

    if (!start && end) {
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
    }
    if (start && !end) {
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }
    if (!start || !end || start > end) return null;

    return { start, end };
  }

  private buildMonthBuckets(rangeStart: Date, rangeEnd: Date) {
    const buckets: { start: Date; end: Date; label: string }[] = [];
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

    while (cursor <= lastMonth && buckets.length < 24) {
      const monthStart = new Date(cursor);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
      const effectiveEnd = monthEnd > rangeEnd ? rangeEnd : monthEnd;
      const effectiveStart = monthStart < rangeStart ? rangeStart : monthStart;
      buckets.push({
        start: effectiveStart,
        end: effectiveEnd,
        label: `${cursor.getMonth() + 1}/${cursor.getFullYear()}`,
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return buckets;
  }
}
