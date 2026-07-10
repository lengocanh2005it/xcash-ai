import { Injectable, StreamableFile } from '@nestjs/common';
import { TransactionSource, TransactionStatus } from '@prisma/client';
import type { AccountSummary } from '@xcash/shared-types';
import * as XLSX from 'xlsx';
import { paginateParams, paginateResult } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportSqlBuilder } from './report.sql';
import { buildDailyTrendBuckets, formatDayKey, periodBounds, startOfDay } from './report-date.util';
import { buildExportWorkbook } from './report-excel.util';

export interface StatusBreakdownItem {
  status: TransactionStatus;
  count: number;
}

export interface SourceBreakdownItem {
  source: TransactionSource;
  count: number;
}

export type { AccountSummary } from '@xcash/shared-types';

@Injectable()
export class ReportDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sql: ReportSqlBuilder,
  ) {}

  async getDailyTrend(tenantId: string, days = 7) {
    const clampedDays = Math.min(31, Math.max(1, days));
    const buckets = buildDailyTrendBuckets(clampedDays);
    const from = buckets[0]?.date
      ? new Date(`${buckets[0].date}T00:00:00`)
      : startOfDay(new Date());
    const to = startOfDay(new Date());
    to.setHours(23, 59, 59, 999);

    const bucketByDay = new Map(buckets.map((bucket) => [bucket.date, bucket]));

    const rows = await this.sql.fetchDashboardDailyTrend(tenantId, from, to);

    for (const row of rows) {
      const bucket = bucketByDay.get(row.day_key);
      if (!bucket) {
        continue;
      }

      const classifiedCount = Number(row.classified_count);
      const revenueAmount = Number(row.revenue_amount);
      const expenseAmount = Number(row.expense_amount);

      bucket.activityCount = Number(row.activity_count);
      bucket.classifiedCount = classifiedCount;
      bucket.revenueAmount = revenueAmount;
      bucket.expenseAmount = expenseAmount;
      bucket.count = classifiedCount;
      bucket.amount = revenueAmount;
    }

    return {
      days: clampedDays,
      from: buckets[0]?.date ?? formatDayKey(from),
      to: buckets.at(-1)?.date ?? formatDayKey(to),
      points: buckets,
    };
  }

  async getStatusBreakdown(tenantId: string) {
    const groups = await this.prisma.transaction.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { _all: true },
    });

    const items: StatusBreakdownItem[] = groups.map((group) => ({
      status: group.status,
      count: group._count._all,
    }));

    const total = items.reduce((sum, item) => sum + item.count, 0);

    return { items, total };
  }

  async getSourceBreakdown(tenantId: string) {
    const groups = await this.prisma.transaction.groupBy({
      by: ['source'],
      where: { tenantId },
      _count: { _all: true },
    });

    const items: SourceBreakdownItem[] = groups.map((group) => ({
      source: group.source,
      count: group._count._all,
    }));

    const total = items.reduce((sum, item) => sum + item.count, 0);

    return { items, total };
  }

  async buildAccountSummaries(
    tenantId: string,
    from: Date,
    to: Date,
    inclusiveEnd = false,
  ): Promise<AccountSummary[]> {
    const { debits, credits } = await this.sql.fetchClassificationSides(
      tenantId,
      from,
      to,
      inclusiveEnd,
    );

    const accountMap = new Map<string, AccountSummary>();
    this.sql.mergeAccountSideAggregates(accountMap, debits, 'debit');
    this.sql.mergeAccountSideAggregates(accountMap, credits, 'credit');

    const codes = [...accountMap.keys()];
    if (codes.length > 0) {
      const accounts = await this.sql.fetchAccountNames(tenantId, codes);
      for (const a of accounts) {
        const entry = accountMap.get(a.accountCode);
        if (entry) {
          entry.accountName = a.accountName;
          entry.accountType = a.accountType;
        }
      }
    }

    return [...accountMap.values()].sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  async getSummary(tenantId: string, year: number, month: number) {
    const { from, to } = periodBounds(year, month);

    const [byAccount, reviewCount, totalCount, classifiedCount] = await Promise.all([
      this.buildAccountSummaries(tenantId, from, to),
      this.prisma.transactionClassification.count({
        where: {
          tenantId,
          status: TransactionStatus.review,
          transaction: { transactionDate: { gte: from, lt: to } },
        },
      }),
      this.prisma.transaction.count({
        where: { tenantId, transactionDate: { gte: from, lt: to } },
      }),
      this.prisma.transactionClassification.count({
        where: {
          tenantId,
          status: TransactionStatus.classified,
          transaction: { transactionDate: { gte: from, lt: to } },
        },
      }),
    ]);

    const totalRevenue = byAccount
      .filter((a) => a.accountType === 'revenue')
      .reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);

    const totalExpense = byAccount
      .filter((a) => a.accountType === 'expense')
      .reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);

    const aiAccuracy = totalCount > 0 ? Math.round((classifiedCount / totalCount) * 100) : 0;

    return {
      period: { year, month },
      summary: { totalRevenue, totalExpense, net: totalRevenue - totalExpense },
      stats: { totalCount, classifiedCount, reviewCount, aiAccuracy },
    };
  }

  async getSummaryByDateRange(tenantId: string, startDate: string, endDate: string) {
    const from = new Date(startDate);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);

    const [byAccount, reviewCount, totalCount, classifiedCount] = await Promise.all([
      this.buildAccountSummaries(tenantId, from, to),
      this.prisma.transactionClassification.count({
        where: {
          tenantId,
          status: TransactionStatus.review,
          transaction: { transactionDate: { gte: from, lte: to } },
        },
      }),
      this.prisma.transaction.count({
        where: { tenantId, transactionDate: { gte: from, lte: to } },
      }),
      this.prisma.transactionClassification.count({
        where: {
          tenantId,
          status: TransactionStatus.classified,
          transaction: { transactionDate: { gte: from, lte: to } },
        },
      }),
    ]);

    const totalRevenue = byAccount
      .filter((a) => a.accountType === 'revenue')
      .reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);

    const totalExpense = byAccount
      .filter((a) => a.accountType === 'expense')
      .reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);

    const aiAccuracy = totalCount > 0 ? Math.round((classifiedCount / totalCount) * 100) : 0;

    return {
      period: { startDate, endDate },
      summary: { totalRevenue, totalExpense, net: totalRevenue - totalExpense },
      stats: { totalCount, classifiedCount, reviewCount, aiAccuracy },
    };
  }

  async getAccountBreakdown(
    tenantId: string,
    year: number,
    month: number,
    filters: { page?: number; limit?: number; search?: string; accountType?: string },
  ) {
    const { from, to } = periodBounds(year, month);
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const search = filters.search?.trim().toLowerCase();
    const accountType =
      filters.accountType && filters.accountType !== 'all' ? filters.accountType : undefined;

    let items = await this.buildAccountSummaries(tenantId, from, to);

    if (search) {
      items = items.filter(
        (a) =>
          a.accountCode.toLowerCase().includes(search) ||
          a.accountName.toLowerCase().includes(search),
      );
    }

    if (accountType) {
      items = items.filter((a) => a.accountType === accountType);
    }

    const total = items.length;
    const { skip: start } = paginateParams(page, limit);

    return paginateResult(items.slice(start, start + limit), total, page, limit);
  }

  async getByAccount(tenantId: string, fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const classifications = await this.prisma.transactionClassification.findMany({
      where: {
        tenantId,
        status: TransactionStatus.classified,
        transaction: { transactionDate: { gte: from, lte: to } },
      },
      include: {
        transaction: { select: { transactionDate: true, content: true, amount: true } },
      },
      orderBy: { transaction: { transactionDate: 'asc' } },
    });

    return classifications.map((c) => ({
      id: c.id,
      date: c.transaction.transactionDate,
      content: c.transaction.content,
      debitAccount: c.debitAccount,
      creditAccount: c.creditAccount,
      amount: Number(c.amount),
      reason: c.reason,
      classificationType: c.classificationType,
    }));
  }

  async fetchExportData(tenantId: string, fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const [tenant, classifications, byAccount, reviewCount, totalCount, classifiedCount] =
      await Promise.all([
        this.prisma.tenant.findUniqueOrThrow({
          where: { id: tenantId },
          select: { businessName: true },
        }),
        this.prisma.transactionClassification.findMany({
          where: {
            tenantId,
            status: TransactionStatus.classified,
            transaction: { transactionDate: { gte: from, lte: to } },
          },
          include: {
            transaction: { select: { transactionDate: true, content: true, amount: true } },
          },
          orderBy: { transaction: { transactionDate: 'asc' } },
        }),
        this.buildAccountSummaries(tenantId, from, to, true),
        this.prisma.transactionClassification.count({
          where: {
            tenantId,
            status: TransactionStatus.review,
            transaction: { transactionDate: { gte: from, lte: to } },
          },
        }),
        this.prisma.transaction.count({
          where: { tenantId, transactionDate: { gte: from, lte: to } },
        }),
        this.prisma.transactionClassification.count({
          where: {
            tenantId,
            status: TransactionStatus.classified,
            transaction: { transactionDate: { gte: from, lte: to } },
          },
        }),
      ]);

    const totalRevenue = byAccount
      .filter((a) => a.accountType === 'revenue')
      .reduce((s, a) => s + a.totalCredit - a.totalDebit, 0);

    const totalExpense = byAccount
      .filter((a) => a.accountType === 'expense')
      .reduce((s, a) => s + a.totalDebit - a.totalCredit, 0);

    const aiAccuracy = totalCount > 0 ? Math.round((classifiedCount / totalCount) * 100) : 0;

    return {
      businessName: tenant.businessName,
      fromDate,
      toDate,
      summary: {
        totalRevenue,
        totalExpense,
        net: totalRevenue - totalExpense,
        classifiedCount,
        reviewCount,
        totalCount,
        aiAccuracy,
      },
      accounts: byAccount,
      details: classifications.map((c) => ({
        transactionDate: c.transaction.transactionDate,
        content: c.transaction.content ?? '',
        amount: Number(c.amount),
        debitAccount: c.debitAccount,
        creditAccount: c.creditAccount,
        classificationType: c.classificationType,
        reason: c.reason,
      })),
    };
  }

  async exportExcel(tenantId: string, fromDate: string, toDate: string): Promise<StreamableFile> {
    const data = await this.fetchExportData(tenantId, fromDate, toDate);

    const wb = buildExportWorkbook({
      businessName: data.businessName,
      fromDate,
      toDate,
      exportedAt: new Date(),
      summary: data.summary,
      accounts: data.accounts,
      details: data.details,
    });

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="bao-cao-dinh-khoan-${fromDate}-${toDate}.xlsx"`,
    });
  }

  async getComparison(tenantId: string, year: number, month: number) {
    const [current, previous] = await Promise.all([
      this.getSummary(tenantId, year, month),
      this.getSummary(tenantId, month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1),
    ]);

    const pctChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / Math.abs(prev)) * 100);
    };

    return {
      current: current.summary,
      previous: previous.summary,
      currentStats: current.stats,
      previousStats: previous.stats,
      changes: {
        revenue: pctChange(current.summary.totalRevenue, previous.summary.totalRevenue),
        expense: pctChange(current.summary.totalExpense, previous.summary.totalExpense),
        net: pctChange(current.summary.net, previous.summary.net),
        aiAccuracy: pctChange(current.stats.aiAccuracy, previous.stats.aiAccuracy),
      },
    };
  }

  async getTopAccounts(tenantId: string, year: number, month: number, limit: number) {
    const { from, to } = periodBounds(year, month);

    const { debits, credits } = await this.sql.fetchClassificationSides(tenantId, from, to, false);

    const expenseMap = new Map(debits.map((row) => [row.account_code, Number(row.total)]));
    const revenueMap = new Map(credits.map((row) => [row.account_code, Number(row.total)]));

    const codes = [...new Set([...expenseMap.keys(), ...revenueMap.keys()])];
    const accounts = codes.length > 0 ? await this.sql.fetchAccountNames(tenantId, codes) : [];

    const accountInfo = new Map(accounts.map((a) => [a.accountCode, a]));

    const topExpense = [...expenseMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([code, total]) => ({
        accountCode: code,
        accountName: accountInfo.get(code)?.accountName ?? code,
        accountType: accountInfo.get(code)?.accountType ?? 'unknown',
        total,
      }));

    const topRevenue = [...revenueMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([code, total]) => ({
        accountCode: code,
        accountName: accountInfo.get(code)?.accountName ?? code,
        accountType: accountInfo.get(code)?.accountType ?? 'unknown',
        total,
      }));

    return { topExpense, topRevenue };
  }
}
