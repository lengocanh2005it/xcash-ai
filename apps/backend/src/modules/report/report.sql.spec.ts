import type { AccountSummary } from '@xcash/shared-types';
import { ReportSqlBuilder } from './report.sql';

describe('ReportSqlBuilder', () => {
  let prisma: {
    $queryRaw: jest.Mock;
    chartOfAccount: {
      findMany: jest.Mock;
    };
  };
  let builder: ReportSqlBuilder;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      chartOfAccount: {
        findMany: jest.fn(),
      },
    };
    builder = new ReportSqlBuilder(prisma as never);
  });

  describe('fetchDashboardDailyTrend', () => {
    it('calls $queryRaw with SQL for daily trend', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const from = new Date('2026-07-01');
      const to = new Date('2026-07-10');
      const result = await builder.fetchDashboardDailyTrend('tenant-1', from, to);

      expect(result).toEqual([]);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

      const callArgs = prisma.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      const template = callArgs[0];
      expect(template.join('')).toContain('date_trunc');
      expect(template.join('')).toContain('transactions t');
    });
  });

  describe('fetchClassificationSides', () => {
    it('returns debits and credits arrays', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await builder.fetchClassificationSides(
        'tenant-1',
        new Date('2026-07-01'),
        new Date('2026-08-01'),
      );

      expect(result).toEqual({ debits: [], credits: [] });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('passes inclusiveEnd flag as <= operator', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await builder.fetchClassificationSides(
        'tenant-1',
        new Date('2026-07-01'),
        new Date('2026-07-31'),
        true,
      );

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchAccountNames', () => {
    it('skips query when codes array is empty', async () => {
      const result = await builder.fetchAccountNames('tenant-1', []);

      expect(result).toEqual([]);
      expect(prisma.chartOfAccount.findMany).not.toHaveBeenCalled();
    });

    it('queries chartOfAccount with given codes', async () => {
      prisma.chartOfAccount.findMany.mockResolvedValue([
        { accountCode: '511', accountName: 'Doanh thu', accountType: 'revenue' },
      ]);

      const result = await builder.fetchAccountNames('tenant-1', ['511']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        accountCode: '511',
        accountName: 'Doanh thu',
        accountType: 'revenue',
      });
      expect(prisma.chartOfAccount.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', accountCode: { in: ['511'] } },
        select: { accountCode: true, accountName: true, accountType: true },
      });
    });
  });

  describe('mergeAccountSideAggregates', () => {
    const dummyAccount = (code: string): AccountSummary => ({
      accountCode: code,
      accountName: code,
      accountType: 'unknown',
      totalDebit: 0,
      totalCredit: 0,
      net: 0,
      transactionCount: 0,
    });

    it('adds debit side to existing record', () => {
      const map = new Map([
        ['511', { ...dummyAccount('511'), totalCredit: 200_000, net: 200_000 }],
      ]);

      builder.mergeAccountSideAggregates(
        map,
        [{ account_code: '511', total: 100_000, tx_count: BigInt(2) }],
        'debit',
      );

      const entry = map.get('511')!;
      expect(entry.totalDebit).toBe(100_000);
      expect(entry.totalCredit).toBe(200_000);
      expect(entry.net).toBe(100_000);
      expect(entry.transactionCount).toBe(2);
    });

    it('adds credit side to existing record', () => {
      const map = new Map([['511', { ...dummyAccount('511'), totalDebit: 50_000, net: -50_000 }]]);

      builder.mergeAccountSideAggregates(
        map,
        [{ account_code: '511', total: 150_000, tx_count: BigInt(1) }],
        'credit',
      );

      const entry = map.get('511')!;
      expect(entry.totalDebit).toBe(50_000);
      expect(entry.totalCredit).toBe(150_000);
      expect(entry.net).toBe(100_000);
      expect(entry.transactionCount).toBe(1);
    });

    it('creates new entry when account not in map', () => {
      const map = new Map<string, AccountSummary>();

      builder.mergeAccountSideAggregates(
        map,
        [{ account_code: '511', total: '500000', tx_count: BigInt(3) }],
        'credit',
      );

      const entry = map.get('511')!;
      expect(entry.accountCode).toBe('511');
      expect(entry.totalDebit).toBe(0);
      expect(entry.totalCredit).toBe(500_000);
      expect(entry.net).toBe(500_000);
      expect(entry.transactionCount).toBe(3);
    });
  });
});
