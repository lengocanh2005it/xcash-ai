import { Injectable } from '@nestjs/common';
import type { AuditLog, Prisma } from '@prisma/client';
import { paginateParams, paginateResult } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  getAuditActionLabel,
  getAuditEntityTypeLabel,
  getStaticActorLabel,
  isAuditActorUserId,
} from './audit-log.labels';
import type { ListAuditLogsQueryDto } from './dto/list-audit-logs.dto';

export interface AuditLogViewItem {
  id: string;
  tenantId: string | null;
  businessName: string | null;
  entityType: string;
  entityTypeLabel: string;
  entityId: string;
  action: string;
  actionLabel: string;
  actor: string;
  actorLabel: string;
  beforeState: Prisma.JsonValue | null;
  afterState: Prisma.JsonValue | null;
  createdAt: Date;
}

export interface PaginatedAuditLogs {
  items: AuditLogViewItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async listForTenant(tenantId: string, query: ListAuditLogsQueryDto): Promise<PaginatedAuditLogs> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const { skip } = paginateParams(page, limit);
    const where = await this.buildWhere({ tenantId, query });

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = await this.toViewItems(rows);

    return {
      ...paginateResult(items, total, page, limit),
      items,
    } as PaginatedAuditLogs;
  }

  async listForPartner(query: ListAuditLogsQueryDto): Promise<PaginatedAuditLogs> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const { skip } = paginateParams(page, limit);
    const where = await this.buildWhere({ tenantId: query.tenantId, query, partnerScope: true });

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const items = await this.toViewItems(rows, { includeBusinessName: true });

    return {
      ...paginateResult(items, total, page, limit),
      items,
    } as PaginatedAuditLogs;
  }

  private async buildWhere(params: {
    tenantId?: string;
    query: ListAuditLogsQueryDto;
    partnerScope?: boolean;
  }): Promise<Prisma.AuditLogWhereInput> {
    const { tenantId, query, partnerScope } = params;

    const createdAt =
      query.fromDate || query.toDate
        ? {
            ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
            ...(query.toDate ? { lte: new Date(`${query.toDate}T23:59:59.999Z`) } : {}),
          }
        : undefined;

    const searchFilter = await this.buildSearchFilter(query.search, {
      tenantId: partnerScope ? undefined : tenantId,
      partnerScope,
    });

    const base: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(searchFilter ?? {}),
    };

    if (partnerScope) {
      return {
        ...(tenantId ? { tenantId } : {}),
        ...base,
      };
    }

    return {
      tenantId: tenantId as string,
      ...base,
    };
  }

  private async buildSearchFilter(
    search: string | undefined,
    scope: { tenantId?: string; partnerScope?: boolean },
  ): Promise<Prisma.AuditLogWhereInput | undefined> {
    const term = search?.trim();
    if (!term) {
      return undefined;
    }

    const orConditions: Prisma.AuditLogWhereInput[] = [
      { entityId: { contains: term, mode: 'insensitive' } },
      { action: { contains: term, mode: 'insensitive' } },
      { actor: { contains: term, mode: 'insensitive' } },
    ];

    const userWhere: Prisma.UserWhereInput = {
      OR: [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ],
    };
    if (scope.tenantId) {
      userWhere.tenantId = scope.tenantId;
    }

    const matchingUsers = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true },
      take: 50,
    });
    if (matchingUsers.length > 0) {
      orConditions.push({ actor: { in: matchingUsers.map((user) => user.id) } });
    }

    if (scope.partnerScope) {
      const matchingTenants = await this.prisma.tenant.findMany({
        where: { businessName: { contains: term, mode: 'insensitive' } },
        select: { id: true },
        take: 50,
      });
      if (matchingTenants.length > 0) {
        orConditions.push({ tenantId: { in: matchingTenants.map((tenant) => tenant.id) } });
      }
    }

    return { OR: orConditions };
  }

  private async toViewItems(
    rows: AuditLog[],
    options?: { includeBusinessName?: boolean },
  ): Promise<AuditLogViewItem[]> {
    const actorLabels = await this.resolveActorLabels(rows.map((row) => row.actor));

    let businessNames = new Map<string, string>();
    if (options?.includeBusinessName) {
      const tenantIds = [...new Set(rows.map((row) => row.tenantId).filter(Boolean))] as string[];
      if (tenantIds.length > 0) {
        const tenants = await this.prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, businessName: true },
        });
        businessNames = new Map(tenants.map((tenant) => [tenant.id, tenant.businessName]));
      }
    }

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      businessName: row.tenantId ? (businessNames.get(row.tenantId) ?? null) : null,
      entityType: row.entityType,
      entityTypeLabel: getAuditEntityTypeLabel(row.entityType),
      entityId: row.entityId,
      action: row.action,
      actionLabel: getAuditActionLabel(row.action),
      actor: row.actor,
      actorLabel: actorLabels.get(row.actor) ?? row.actor,
      beforeState: row.beforeState,
      afterState: row.afterState,
      createdAt: row.createdAt,
    }));
  }

  private async resolveActorLabels(actors: string[]): Promise<Map<string, string>> {
    const labels = new Map<string, string>();
    const userIds = new Set<string>();

    for (const actor of actors) {
      const staticLabel = getStaticActorLabel(actor);
      if (staticLabel) {
        labels.set(actor, staticLabel);
        continue;
      }
      if (isAuditActorUserId(actor)) {
        userIds.add(actor);
      }
    }

    if (userIds.size > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true, role: true },
      });

      for (const user of users) {
        labels.set(user.id, user.name);
      }
    }

    return labels;
  }
}
