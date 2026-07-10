import { Injectable } from '@nestjs/common';
import { Prisma, TransactionDirection, TransactionSource, TransactionStatus } from '@prisma/client';
import type { AccountSummary } from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { startOfDay } from './report-date.util';

export interface DailyTrendSqlRow {
  day_key: string;
  activity_count: bigint;
  classified_count: bigint;
  revenue_amount: unknown;
  expense_amount: unknown;
}

export interface AccountSideSqlRow {
  account_code: string;
  total: unknown;
  tx_count: bigint;
}

@Injectable()
export class ReportSqlBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async fetchDashboardDailyTrend(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<DailyTrendSqlRow[]> {
    const dateEnd = startOfDay(to);
    dateEnd.setHours(23, 59, 59, 999);

    return this.prisma.$queryRaw<DailyTrendSqlRow[]>`
      SELECT
        to_char(date_trunc('day', t.transaction_date), 'YYYY-MM-DD') AS day_key,
        COUNT(*)::bigint AS activity_count,
        COUNT(*) FILTER (WHERE t.status::text = ${TransactionStatus.classified})::bigint AS classified_count,
        COALESCE(SUM(
          CASE WHEN t.status::text = ${TransactionStatus.classified} AND (
            (t.source::text = ${TransactionSource.import} AND t.direction::text = ${TransactionDirection.in})
            OR (t.source::text <> ${TransactionSource.import} AND t.amount > 0)
          ) THEN ABS(t.amount) ELSE 0 END
        ), 0) AS revenue_amount,
        COALESCE(SUM(
          CASE WHEN t.status::text = ${TransactionStatus.classified} AND (
            (t.source::text = ${TransactionSource.import} AND t.direction::text = ${TransactionDirection.out})
            OR (t.source::text <> ${TransactionSource.import} AND t.amount < 0)
          ) THEN ABS(t.amount) ELSE 0 END
        ), 0) AS expense_amount
      FROM transactions t
      WHERE t.tenant_id = ${tenantId}
        AND t.transaction_date >= ${from}
        AND t.transaction_date <= ${dateEnd}
      GROUP BY 1
      ORDER BY 1
    `;
  }

  async fetchClassificationSides(
    tenantId: string,
    from: Date,
    to: Date,
    inclusiveEnd = false,
  ): Promise<{ debits: AccountSideSqlRow[]; credits: AccountSideSqlRow[] }> {
    const dateEnd = inclusiveEnd
      ? Prisma.sql`t.transaction_date <= ${to}`
      : Prisma.sql`t.transaction_date < ${to}`;

    const [debits, credits] = await Promise.all([
      this.prisma.$queryRaw<AccountSideSqlRow[]>`
        SELECT
          tc.debit_account AS account_code,
          COALESCE(SUM(tc.amount::numeric), 0) AS total,
          COUNT(*)::bigint AS tx_count
        FROM transaction_classifications tc
        INNER JOIN transactions t ON t.id = tc.transaction_id
        WHERE tc.tenant_id = ${tenantId}
          AND tc.status::text = ${TransactionStatus.classified}
          AND t.transaction_date >= ${from}
          AND ${dateEnd}
        GROUP BY tc.debit_account
      `,
      this.prisma.$queryRaw<AccountSideSqlRow[]>`
        SELECT
          tc.credit_account AS account_code,
          COALESCE(SUM(tc.amount::numeric), 0) AS total,
          COUNT(*)::bigint AS tx_count
        FROM transaction_classifications tc
        INNER JOIN transactions t ON t.id = tc.transaction_id
        WHERE tc.tenant_id = ${tenantId}
          AND tc.status::text = ${TransactionStatus.classified}
          AND t.transaction_date >= ${from}
          AND ${dateEnd}
        GROUP BY tc.credit_account
      `,
    ]);

    return { debits, credits };
  }

  async fetchAccountNames(
    tenantId: string,
    codes: string[],
  ): Promise<{ accountCode: string; accountName: string; accountType: string }[]> {
    if (codes.length === 0) {
      return [];
    }

    return this.prisma.chartOfAccount.findMany({
      where: { tenantId, accountCode: { in: codes } },
      select: { accountCode: true, accountName: true, accountType: true },
    });
  }

  mergeAccountSideAggregates(
    map: Map<string, AccountSummary>,
    rows: AccountSideSqlRow[],
    side: 'debit' | 'credit',
  ): void {
    for (const row of rows) {
      const amount = Number(row.total);
      const count = Number(row.tx_count);
      const existing = map.get(row.account_code);
      if (existing) {
        if (side === 'debit') {
          existing.totalDebit += amount;
        } else {
          existing.totalCredit += amount;
        }
        existing.transactionCount += count;
        existing.net = existing.totalCredit - existing.totalDebit;
        continue;
      }

      map.set(row.account_code, {
        accountCode: row.account_code,
        accountName: row.account_code,
        accountType: 'unknown',
        totalDebit: side === 'debit' ? amount : 0,
        totalCredit: side === 'credit' ? amount : 0,
        net: (side === 'credit' ? amount : 0) - (side === 'debit' ? amount : 0),
        transactionCount: count,
      });
    }
  }
}
