import { TransactionStatus } from '@paypilot/shared-types';
import type { TransactionSummary } from '@/types/transaction';

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'Chờ xử lý',
  [TransactionStatus.MATCHED]: 'Đã khớp',
  [TransactionStatus.REVIEW]: 'Cần review',
  [TransactionStatus.SKIPPED]: 'Bỏ qua',
};

export const TRANSACTION_STATUS_COLORS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'var(--chart-4)',
  [TransactionStatus.MATCHED]: 'var(--chart-1)',
  [TransactionStatus.REVIEW]: 'var(--chart-2)',
  [TransactionStatus.SKIPPED]: 'var(--chart-5)',
};

export interface DailyTransactionTrendPoint {
  label: string;
  count: number;
  amount: number;
}

export interface TransactionStatusSlice {
  status: TransactionStatus;
  label: string;
  value: number;
  color: string;
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function buildDailyTransactionTrend(
  items: TransactionSummary[],
  days = 7,
): DailyTransactionTrendPoint[] {
  const today = startOfDay(new Date());
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - 1 - index));

    return {
      date,
      label: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      count: 0,
      amount: 0,
    };
  });

  for (const item of items) {
    const itemDay = startOfDay(new Date(item.transactionDate)).getTime();
    const bucket = buckets.find((entry) => entry.date.getTime() === itemDay);
    if (!bucket) {
      continue;
    }

    bucket.count += 1;
    bucket.amount += Number(item.amount) || 0;
  }

  return buckets.map(({ label, count, amount }) => ({ label, count, amount }));
}

export function buildTransactionStatusBreakdown(
  items: TransactionSummary[],
): TransactionStatusSlice[] {
  const counts: Record<TransactionStatus, number> = {
    [TransactionStatus.PENDING]: 0,
    [TransactionStatus.MATCHED]: 0,
    [TransactionStatus.REVIEW]: 0,
    [TransactionStatus.SKIPPED]: 0,
  };

  for (const item of items) {
    if (item.status in counts) {
      counts[item.status as TransactionStatus] += 1;
    }
  }

  return (Object.values(TransactionStatus) as TransactionStatus[])
    .map((status) => ({
      status,
      label: TRANSACTION_STATUS_LABELS[status],
      value: counts[status],
      color: TRANSACTION_STATUS_COLORS[status],
    }))
    .filter((slice) => slice.value > 0);
}

export function formatCurrency(amount: number) {
  return `${amount.toLocaleString('vi-VN')}đ`;
}
