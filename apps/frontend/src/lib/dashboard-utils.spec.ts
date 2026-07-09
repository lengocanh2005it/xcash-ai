import { TransactionStatus } from '@xcash/shared-types';
import { describe, expect, it } from 'vitest';
import type { TransactionSummary } from '@/types/transaction';
import {
  buildDailyTransactionTrend,
  buildDashboardOverviewStats,
  buildTransactionStatusBreakdown,
  mapDailyTrendResponse,
  mapSourceBreakdownResponse,
  mapStatusBreakdownResponse,
} from './dashboard-utils';

function makeTxn(overrides: Partial<TransactionSummary> = {}): TransactionSummary {
  return {
    id: '1',
    transactionId: 'TXN001',
    amount: '1000000',
    content: 'Test transaction',
    status: TransactionStatus.CLASSIFIED,
    source: 'cas',
    transactionDate: new Date().toISOString(),
    senderAccount: '123456',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    confidenceScore: 90,
    ...overrides,
  } as TransactionSummary;
}

describe('dashboard-utils', () => {
  describe('mapDailyTrendResponse', () => {
    it('maps API response to chart data', () => {
      const response = {
        days: 7,
        from: '2026-01-01',
        to: '2026-01-07',
        points: [
          {
            label: '01/01',
            count: 10,
            amount: 500000,
            activityCount: 8,
            classifiedCount: 7,
            revenueAmount: 300000,
            expenseAmount: 200000,
          },
          { label: '02/01', count: 5, amount: 250000 },
        ],
      };

      const result = mapDailyTrendResponse(response);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('01/01');
      expect(result[0].classifiedCount).toBe(7);
      expect(result[0].revenueAmount).toBe(300000);
      expect(result[1].activityCount).toBe(0);
    });
  });

  describe('mapStatusBreakdownResponse', () => {
    it('maps status breakdown', () => {
      const response = {
        items: [
          { status: 'classified', count: 50 },
          { status: 'pending', count: 10 },
        ],
        total: 60,
      };

      const result = mapStatusBreakdownResponse(response);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const classified = result.find((s) => s.status === TransactionStatus.CLASSIFIED);
      expect(classified?.value).toBe(50);
    });

    it('filters out zero values', () => {
      const response = {
        items: [{ status: 'classified', count: 50 }],
        total: 50,
      };

      const result = mapStatusBreakdownResponse(response);
      expect(result.every((s) => s.value > 0)).toBe(true);
    });
  });

  describe('mapSourceBreakdownResponse', () => {
    it('maps source breakdown', () => {
      const response = {
        items: [
          { source: 'cas', count: 30 },
          { source: 'import', count: 20 },
        ],
        total: 50,
      };

      const result = mapSourceBreakdownResponse(response);
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('Ngân hàng');
      expect(result[1].label).toBe('Import Excel');
    });
  });

  describe('buildDailyTransactionTrend', () => {
    it('builds trend from transaction items', () => {
      const items = [
        makeTxn({ transactionDate: new Date().toISOString(), amount: '1000000' }),
        makeTxn({ transactionDate: new Date().toISOString(), amount: '2000000' }),
      ];

      const result = buildDailyTransactionTrend(items, 1);
      expect(result).toHaveLength(1);
      expect(result[0].count).toBe(2);
      expect(result[0].amount).toBe(3000000);
    });
  });

  describe('buildTransactionStatusBreakdown', () => {
    it('counts statuses', () => {
      const items = [
        makeTxn({ status: TransactionStatus.CLASSIFIED }),
        makeTxn({ status: TransactionStatus.CLASSIFIED }),
        makeTxn({ status: TransactionStatus.PENDING }),
      ];

      const result = buildTransactionStatusBreakdown(items);
      const classified = result.find((s) => s.status === TransactionStatus.CLASSIFIED);
      const pending = result.find((s) => s.status === TransactionStatus.PENDING);
      expect(classified?.value).toBe(2);
      expect(pending?.value).toBe(1);
    });
  });

  describe('buildDashboardOverviewStats', () => {
    it('calculates stats', () => {
      const items = [
        makeTxn({
          status: TransactionStatus.CLASSIFIED,
          amount: '5000000',
          transactionDate: new Date().toISOString(),
          confidenceScore: 95,
        }),
        makeTxn({
          status: TransactionStatus.PENDING,
          amount: '1000000',
          transactionDate: new Date().toISOString(),
        }),
      ];

      const result = buildDashboardOverviewStats(items);
      expect(result.pendingCount).toBe(1);
      expect(result.classifiedTodayCount).toBe(1);
      expect(result.todayRevenue).toBe(5000000);
    });
  });
});
