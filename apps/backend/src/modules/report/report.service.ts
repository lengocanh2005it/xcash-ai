import { Injectable, StreamableFile } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import type { AccountBreakdownQueryDto } from './dto/account-breakdown.dto';
import { buildExportWorkbook } from './report-excel.util';

export interface AccountSummary {
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
  transactionCount: number;
}

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  private periodBounds(year: number, month: number) {
    return {
      from: new Date(year, month - 1, 1),
      to: new Date(year, month, 1),
    };
  }

  private async buildAccountSummaries(
    tenantId: string,
    from: Date,
    to: Date,
    inclusiveEnd = false,
  ): Promise<AccountSummary[]> {
    const classifications = await this.prisma.transactionClassification.findMany({
      where: {
        tenantId,
        status: TransactionStatus.classified,
        transaction: {
          transactionDate: inclusiveEnd ? { gte: from, lte: to } : { gte: from, lt: to },
        },
      },
      select: { debitAccount: true, creditAccount: true, amount: true },
    });

    const accountMap = new Map<string, AccountSummary>();

    for (const c of classifications) {
      const amount = Number(c.amount);
      this.updateAccount(accountMap, c.debitAccount, amount, 0);
      this.updateAccount(accountMap, c.creditAccount, 0, amount);
    }

    const codes = [...accountMap.keys()];
    if (codes.length > 0) {
      const accounts = await this.prisma.chartOfAccount.findMany({
        where: { tenantId, accountCode: { in: codes } },
        select: { accountCode: true, accountName: true, accountType: true },
      });
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
    const { from, to } = this.periodBounds(year, month);

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

  async getAccountBreakdown(
    tenantId: string,
    year: number,
    month: number,
    query: AccountBreakdownQueryDto,
  ) {
    const { from, to } = this.periodBounds(year, month);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const search = query.search?.trim().toLowerCase();
    const accountType =
      query.accountType && query.accountType !== 'all' ? query.accountType : undefined;

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
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      page,
      limit,
      total,
    };
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

  async exportExcel(tenantId: string, fromDate: string, toDate: string): Promise<StreamableFile> {
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

    const wb = buildExportWorkbook({
      businessName: tenant.businessName,
      fromDate,
      toDate,
      exportedAt: new Date(),
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
      // Chia cho |prev| thay vì prev để tránh lật dấu khi baseline âm (vd lãi/lỗ
      // chuyển từ lỗ sang lãi) — dùng prev trực tiếp cho ra % ngược hướng cải thiện thực tế.
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
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const classifications = await this.prisma.transactionClassification.findMany({
      where: {
        tenantId,
        status: TransactionStatus.classified,
        transaction: { transactionDate: { gte: from, lt: to } },
      },
      select: { debitAccount: true, creditAccount: true, amount: true },
    });

    const expenseMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();

    for (const c of classifications) {
      const amt = Number(c.amount);
      expenseMap.set(c.debitAccount, (expenseMap.get(c.debitAccount) ?? 0) + amt);
      revenueMap.set(c.creditAccount, (revenueMap.get(c.creditAccount) ?? 0) + amt);
    }

    const codes = [...new Set([...expenseMap.keys(), ...revenueMap.keys()])];
    const accounts =
      codes.length > 0
        ? await this.prisma.chartOfAccount.findMany({
            where: { tenantId, accountCode: { in: codes } },
            select: { accountCode: true, accountName: true, accountType: true },
          })
        : [];

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

  private updateAccount(
    map: Map<string, AccountSummary>,
    code: string,
    debit: number,
    credit: number,
  ): void {
    const existing = map.get(code);
    if (existing) {
      existing.totalDebit += debit;
      existing.totalCredit += credit;
      existing.net = existing.totalCredit - existing.totalDebit;
      existing.transactionCount += 1;
    } else {
      map.set(code, {
        accountCode: code,
        accountName: code,
        accountType: 'unknown',
        totalDebit: debit,
        totalCredit: credit,
        net: credit - debit,
        transactionCount: 1,
      });
    }
  }
}
