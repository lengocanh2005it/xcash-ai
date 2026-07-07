import { TransactionSource, TransactionStatus } from '@prisma/client';
import { ReportService } from './report.service';

describe('ReportService dashboard charts', () => {
  const tenantId = 'tenant-1';

  let prisma: {
    transaction: {
      groupBy: jest.Mock;
    };
    $queryRaw: jest.Mock;
  };
  let service: ReportService;

  beforeEach(() => {
    prisma = {
      transaction: {
        groupBy: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    service = new ReportService(prisma as never);
  });

  describe('getDailyTrend', () => {
    it('returns zero-filled buckets for each day in range', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.getDailyTrend(tenantId, 7);

      expect(result.days).toBe(7);
      expect(result.points).toHaveLength(7);
      expect(
        result.points.every(
          (point) =>
            point.activityCount === 0 && point.revenueAmount === 0 && point.expenseAmount === 0,
        ),
      ).toBe(true);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('aggregates revenue, expense, and activity into daily buckets', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const todayKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');

      prisma.$queryRaw.mockResolvedValue([
        {
          day_key: todayKey,
          activity_count: BigInt(2),
          classified_count: BigInt(2),
          revenue_amount: 1_000_000,
          expense_amount: 400_000,
        },
      ]);

      const result = await service.getDailyTrend(tenantId, 7);
      const todayBucket = result.points.find((point) => point.date === todayKey);

      expect(todayBucket).toEqual(
        expect.objectContaining({
          classifiedCount: 2,
          revenueAmount: 1_000_000,
          expenseAmount: 400_000,
          activityCount: 2,
          amount: 1_000_000,
          count: 2,
        }),
      );
    });

    it('treats import direction as revenue or expense', async () => {
      const today = new Date();
      today.setHours(10, 0, 0, 0);
      const todayKey = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-');

      prisma.$queryRaw.mockResolvedValue([
        {
          day_key: todayKey,
          activity_count: BigInt(1),
          classified_count: BigInt(2),
          revenue_amount: 200_000,
          expense_amount: 150_000,
        },
      ]);

      const result = await service.getDailyTrend(tenantId, 7);
      const todayBucket = result.points.find((point) => point.date === todayKey);

      expect(todayBucket).toEqual(
        expect.objectContaining({
          revenueAmount: 200_000,
          expenseAmount: 150_000,
        }),
      );
    });
  });

  describe('getStatusBreakdown', () => {
    it('maps groupBy results and total count', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { status: TransactionStatus.pending, _count: { _all: 3 } },
        { status: TransactionStatus.classified, _count: { _all: 10 } },
      ]);

      const result = await service.getStatusBreakdown(tenantId);

      expect(result.total).toBe(13);
      expect(result.items).toEqual([
        { status: TransactionStatus.pending, count: 3 },
        { status: TransactionStatus.classified, count: 10 },
      ]);
    });
  });

  describe('getSourceBreakdown', () => {
    it('maps groupBy source and total count', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { source: TransactionSource.cas, _count: { _all: 8 } },
        { source: TransactionSource.import, _count: { _all: 2 } },
      ]);

      const result = await service.getSourceBreakdown(tenantId);

      expect(result.total).toBe(10);
      expect(result.items).toEqual([
        { source: TransactionSource.cas, count: 8 },
        { source: TransactionSource.import, count: 2 },
      ]);
    });
  });
});
