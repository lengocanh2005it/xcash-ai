import { Injectable, StreamableFile } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';

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

  async getSummary(tenantId: string, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);

    const [classifications, reviewCount, totalCount, classifiedCount] = await Promise.all([
      this.prisma.transactionClassification.findMany({
        where: {
          tenantId,
          status: TransactionStatus.classified,
          transaction: { transactionDate: { gte: from, lt: to } },
        },
        include: {
          transaction: { select: { transactionDate: true, content: true, amount: true } },
        },
      }),
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

    const accountMap = new Map<string, AccountSummary>();

    for (const c of classifications) {
      const amount = Number(c.amount);

      this.updateAccount(accountMap, c.debitAccount, amount, 0, tenantId);
      this.updateAccount(accountMap, c.creditAccount, 0, amount, tenantId);
    }

    // Enrich with account names
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

    const byAccount = [...accountMap.values()].sort((a, b) =>
      a.accountCode.localeCompare(b.accountCode),
    );

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
      byAccount,
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

    const rows = classifications.map((c, i) => ({
      STT: i + 1,
      'Ngày GD': c.transaction.transactionDate.toLocaleDateString('vi-VN'),
      'Nội dung': c.transaction.content ?? '',
      'Số tiền': Number(c.amount),
      'TK Nợ': c.debitAccount,
      'TK Có': c.creditAccount,
      'Phân loại': c.classificationType === 'auto' ? 'Tự động (AI)' : 'Thủ công',
      'Lý do AI': c.reason ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 12 },
      { wch: 50 },
      { wch: 15 },
      { wch: 8 },
      { wch: 8 },
      { wch: 15 },
      { wch: 50 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Định khoản');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="bao-cao-dinh-khoan-${fromDate}-${toDate}.xlsx"`,
    });
  }

  private updateAccount(
    map: Map<string, AccountSummary>,
    code: string,
    debit: number,
    credit: number,
    _tenantId: string,
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
