import { Injectable } from '@nestjs/common';
import type { AiCallType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { calcCostUsd } from '../../common/constants/ai-pricing';
import { paginateParams, totalPagesFromTotal } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { parseFilterEndDate, parseFilterStartDate } from './utils/date.util';

@Injectable()
export class AiCostService {
  constructor(private readonly prisma: PrismaService) {}

  async getAiCosts(params: {
    fromDate?: string;
    toDate?: string;
    tenantId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const { skip } = paginateParams(page, limit);

    const conditions: Prisma.Sql[] = [];
    if (params.tenantId) conditions.push(Prisma.sql`tenant_id = ${params.tenantId}`);
    const periodStart = parseFilterStartDate(params.fromDate);
    const periodEnd = parseFilterEndDate(params.toDate);
    if (periodStart) conditions.push(Prisma.sql`created_at >= ${periodStart}`);
    if (periodEnd) conditions.push(Prisma.sql`created_at <= ${periodEnd}`);
    const whereClause =
      conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.sql``;

    type GroupedRow = {
      tenant_id: string;
      call_type: string;
      model: string;
      tokens_in: bigint;
      tokens_out: bigint;
      call_count: bigint;
    };

    const grouped = await this.prisma.$queryRaw<GroupedRow[]>`
      SELECT tenant_id, call_type, model,
             SUM(tokens_in)::bigint  AS tokens_in,
             SUM(tokens_out)::bigint AS tokens_out,
             COUNT(*)::bigint        AS call_count
      FROM ai_usage_logs
      ${whereClause}
      GROUP BY tenant_id, call_type, model
    `;

    const tenantIds: string[] = [...new Set(grouped.map((r) => r.tenant_id))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, businessName: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.businessName]));

    type Breakdown = Record<
      string,
      { tokensIn: number; tokensOut: number; costUsd: number; callCount: number }
    >;
    type CallTypeSummary = Record<
      string,
      { tokensIn: number; tokensOut: number; costUsd: number; callCount: number }
    >;
    const aggregated = new Map<
      string,
      { tokensIn: number; tokensOut: number; costUsd: number; breakdown: Breakdown }
    >();
    const callTypeSummary: CallTypeSummary = {};
    let grandTotalCalls = 0;
    let grandTotalTokensIn = 0;
    let grandTotalTokensOut = 0;

    for (const row of grouped) {
      const tIn = Number(row.tokens_in);
      const tOut = Number(row.tokens_out);
      const count = Number(row.call_count);
      const cost = calcCostUsd(row.model, tIn, tOut);

      grandTotalCalls += count;
      grandTotalTokensIn += tIn;
      grandTotalTokensOut += tOut;

      const ct = row.call_type;
      if (!callTypeSummary[ct])
        callTypeSummary[ct] = { tokensIn: 0, tokensOut: 0, costUsd: 0, callCount: 0 };
      callTypeSummary[ct].tokensIn += tIn;
      callTypeSummary[ct].tokensOut += tOut;
      callTypeSummary[ct].costUsd += cost;
      callTypeSummary[ct].callCount += count;

      if (!aggregated.has(row.tenant_id)) {
        aggregated.set(row.tenant_id, { tokensIn: 0, tokensOut: 0, costUsd: 0, breakdown: {} });
      }
      const agg = aggregated.get(row.tenant_id)!;
      agg.tokensIn += tIn;
      agg.tokensOut += tOut;
      agg.costUsd += cost;

      if (!agg.breakdown[ct])
        agg.breakdown[ct] = { tokensIn: 0, tokensOut: 0, costUsd: 0, callCount: 0 };
      agg.breakdown[ct].tokensIn += tIn;
      agg.breakdown[ct].tokensOut += tOut;
      agg.breakdown[ct].costUsd += cost;
      agg.breakdown[ct].callCount += count;
    }

    const sorted = [...aggregated.entries()].sort((a, b) => b[1].costUsd - a[1].costUsd);
    const total = sorted.length;
    const items = sorted.slice(skip, skip + limit).map(([tid, agg]) => ({
      tenantId: tid,
      tenantName: tenantMap.get(tid) ?? tid,
      totalTokensIn: agg.tokensIn,
      totalTokensOut: agg.tokensOut,
      totalCostUsd: Math.round(agg.costUsd * 1_000_000) / 1_000_000,
      breakdown: agg.breakdown,
    }));

    const grandTotalCostUsd = sorted.reduce((s, [, a]) => s + a.costUsd, 0);
    const roundUsd = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

    return {
      items,
      total,
      page,
      limit,
      totalPages: totalPagesFromTotal(total, limit),
      grandTotalCostUsd: roundUsd(grandTotalCostUsd),
      grandTotalCalls,
      grandTotalTokensIn,
      grandTotalTokensOut,
      tenantCount: total,
      callTypeSummary: Object.fromEntries(
        Object.entries(callTypeSummary).map(([key, value]) => [
          key,
          { ...value, costUsd: roundUsd(value.costUsd) },
        ]),
      ),
    };
  }

  async getAiCostDetail(params: {
    tenantId: string;
    callType?: AiCallType;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const { skip } = paginateParams(page, limit);

    const periodStart = parseFilterStartDate(params.fromDate);
    const periodEnd = parseFilterEndDate(params.toDate);

    const where: Prisma.AiUsageLogWhereInput = {
      tenantId: params.tenantId,
      ...(params.callType ? { callType: params.callType } : {}),
      ...(periodStart || periodEnd
        ? {
            createdAt: {
              ...(periodStart ? { gte: periodStart } : {}),
              ...(periodEnd ? { lte: periodEnd } : {}),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aiUsageLog.count({ where }),
    ]);

    return {
      items: logs.map((l) => ({
        id: l.id,
        callType: l.callType,
        model: l.model,
        tokensIn: l.tokensIn,
        tokensOut: l.tokensOut,
        costUsd: Math.round(calcCostUsd(l.model, l.tokensIn, l.tokensOut) * 1_000_000) / 1_000_000,
        transactionId: l.transactionId,
        conversationId: l.conversationId,
        createdAt: l.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: totalPagesFromTotal(total, limit),
    };
  }
}
