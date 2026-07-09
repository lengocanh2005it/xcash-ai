import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { SubscriptionStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '../../common/util/audit-log.util';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { getMonthStart } from './utils/date.util';

@Injectable()
export class TenantManagementService {
  private readonly logger = new Logger(TenantManagementService.name);

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
    const statusFilter =
      params?.status && params.status !== 'all' ? (params.status as SubscriptionStatus) : undefined;
    const planFilter =
      params?.plan && params.plan !== 'all'
        ? (params.plan as import('@prisma/client').SubscriptionPlan)
        : undefined;
    const page = Math.max(1, Math.trunc(params?.page ?? 1));
    const limit = params?.limit ? Math.min(100, Math.max(1, Math.trunc(params.limit))) : null;

    const tenantWhere: Prisma.TenantWhereInput = {
      ...(search ? { businessName: { contains: search, mode: 'insensitive' } } : {}),
    };

    if (statusFilter || planFilter) {
      tenantWhere.subscriptions = {
        some: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(planFilter ? { plan: planFilter } : {}),
        },
      };
    }

    const monthStart = getMonthStart();

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where: tenantWhere,
        include: {
          subscriptions: { orderBy: { startedAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { skip: (page - 1) * limit, take: limit } : {}),
      }),
      this.prisma.tenant.count({ where: tenantWhere }),
    ]);

    const tenantIds = tenants.map((tenant) => tenant.id);
    const transactionCounts =
      tenantIds.length > 0
        ? await this.prisma.transaction.groupBy({
            by: ['tenantId'],
            where: { tenantId: { in: tenantIds }, createdAt: { gte: monthStart } },
            _count: { _all: true },
          })
        : [];
    const countsByTenant = new Map(transactionCounts.map((c) => [c.tenantId, c._count._all]));

    const items = tenants.map((tenant) => {
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

    if (!limit) {
      return { items, page: 1, limit: total, total, totalPages: 1 };
    }

    return {
      items,
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

    const monthStart = getMonthStart();
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

    await createAuditLog(this.prisma, {
      tenantId,
      entityType: 'tenant',
      entityId: tenantId,
      action: 'tenant_suspended',
      actor: partnerUserId,
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

    await createAuditLog(this.prisma, {
      tenantId,
      entityType: 'tenant',
      entityId: tenantId,
      action: 'tenant_activated',
      actor: partnerUserId,
    });

    return { success: true };
  }

  private async getLatestSubscription(tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
    });
    if (!subscription) throw new NotFoundException('Không tìm thấy doanh nghiệp');
    return subscription;
  }
}
