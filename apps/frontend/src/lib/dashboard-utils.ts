import { TransactionStatus } from '@xcash/shared-types';
import type { TransactionSummary } from '@/types/transaction';

// ─── Constants ────────────────────────────────────────────────────────────────

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'Chờ xử lý',
  [TransactionStatus.CLASSIFIED]: 'Đã định khoản',
  [TransactionStatus.REVIEW]: 'Cần review',
  [TransactionStatus.SKIPPED]: 'Bỏ qua',
};

export const TRANSACTION_STATUS_COLORS: Record<TransactionStatus, string> = {
  [TransactionStatus.PENDING]: 'var(--chart-4)',
  [TransactionStatus.CLASSIFIED]: 'var(--chart-1)',
  [TransactionStatus.REVIEW]: 'var(--chart-2)',
  [TransactionStatus.SKIPPED]: 'var(--chart-5)',
};

export const TRANSACTION_SOURCE_LABELS: Record<string, string> = {
  cas: 'Ngân hàng',
  import: 'Import Excel',
};

export const TRANSACTION_SOURCE_COLORS: Record<string, string> = {
  cas: 'var(--chart-3)',
  import: 'var(--chart-4)',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyTransactionTrendPoint {
  label: string;
  count: number;
  amount: number;
  activityCount: number;
  classifiedCount: number;
  revenueAmount: number;
  expenseAmount: number;
}

export interface TransactionStatusSlice {
  status: TransactionStatus;
  label: string;
  value: number;
  color: string;
}

export interface DailyTrendApiResponse {
  days: number;
  from: string;
  to: string;
  points: Array<{
    label: string;
    count: number;
    amount: number;
    activityCount?: number;
    classifiedCount?: number;
    revenueAmount?: number;
    expenseAmount?: number;
  }>;
}

export interface StatusBreakdownApiItem {
  status: string;
  count: number;
}

export interface StatusBreakdownApiResponse {
  items: StatusBreakdownApiItem[];
  total: number;
}

export interface SourceBreakdownApiItem {
  source: 'cas' | 'import' | string;
  count: number;
}

export interface SourceBreakdownApiResponse {
  items: SourceBreakdownApiItem[];
  total: number;
}

export interface DonutSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}

// ─── Mapping functions ────────────────────────────────────────────────────────

export function mapDailyTrendResponse(
  response: DailyTrendApiResponse,
): DailyTransactionTrendPoint[] {
  return response.points.map((point) => ({
    label: point.label,
    count: point.classifiedCount ?? point.count,
    amount: point.revenueAmount ?? point.amount,
    activityCount: point.activityCount ?? 0,
    classifiedCount: point.classifiedCount ?? point.count,
    revenueAmount: point.revenueAmount ?? point.amount,
    expenseAmount: point.expenseAmount ?? 0,
  }));
}

export function mapStatusBreakdownResponse(
  response: StatusBreakdownApiResponse,
): TransactionStatusSlice[] {
  const counts = new Map<string, number>();
  for (const item of response.items) {
    counts.set(item.status, item.count);
  }

  return (Object.values(TransactionStatus) as TransactionStatus[])
    .map((status) => ({
      status,
      label: TRANSACTION_STATUS_LABELS[status],
      value: counts.get(status) ?? 0,
      color: TRANSACTION_STATUS_COLORS[status],
    }))
    .filter((slice) => slice.value > 0);
}

export function mapSourceBreakdownResponse(response: SourceBreakdownApiResponse): DonutSlice[] {
  return response.items
    .map((item) => ({
      id: item.source,
      label: TRANSACTION_SOURCE_LABELS[item.source] ?? item.source,
      value: item.count,
      color: TRANSACTION_SOURCE_COLORS[item.source] ?? 'var(--chart-4)',
    }))
    .filter((slice) => slice.value > 0);
}

// ─── Builder functions ────────────────────────────────────────────────────────

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
      activityCount: 0,
      classifiedCount: 0,
      revenueAmount: 0,
      expenseAmount: 0,
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

  return buckets.map(
    ({ label, count, amount, activityCount, classifiedCount, revenueAmount, expenseAmount }) => ({
      label,
      count,
      amount,
      activityCount,
      classifiedCount,
      revenueAmount,
      expenseAmount,
    }),
  );
}

export function buildDailyRevenueTrend(
  items: TransactionSummary[],
  days = 7,
): DailyTransactionTrendPoint[] {
  const classifiedItems = items.filter(
    (item) => item.status === TransactionStatus.CLASSIFIED && Number(item.amount) > 0,
  );
  return buildDailyTransactionTrend(classifiedItems, days);
}

export function buildTransactionStatusBreakdown(
  items: TransactionSummary[],
): TransactionStatusSlice[] {
  const counts: Record<TransactionStatus, number> = {
    [TransactionStatus.PENDING]: 0,
    [TransactionStatus.CLASSIFIED]: 0,
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

// ─── Dashboard overview stats ─────────────────────────────────────────────────

export interface DashboardOverviewStats {
  todayRevenue: number;
  yesterdayRevenue: number;
  revenueChangePercent: number | null;
  pendingCount: number;
  reviewCount: number;
  classifiedTodayCount: number;
  classifiedYesterdayCount: number;
  classifiedChangePercent: number | null;
  aiAccuracyPercent: number | null;
}

export function getTransactionConfidenceScore(item: TransactionSummary): number | null {
  return item.classification?.confidenceScore ?? item.confidenceScore ?? null;
}

export function buildDashboardOverviewStats(items: TransactionSummary[]): DashboardOverviewStats {
  const today = startOfDay(new Date());
  const yesterday = startOfDay(new Date());
  yesterday.setDate(yesterday.getDate() - 1);

  let todayRevenue = 0;
  let yesterdayRevenue = 0;
  let pendingCount = 0;
  let reviewCount = 0;
  let classifiedTodayCount = 0;
  let classifiedYesterdayCount = 0;
  let scoredCount = 0;
  let highConfidenceCount = 0;

  for (const item of items) {
    const amount = Number(item.amount) || 0;
    const itemDay = startOfDay(new Date(item.transactionDate)).getTime();
    const confidenceScore = getTransactionConfidenceScore(item);

    if (item.status === TransactionStatus.PENDING) {
      pendingCount += 1;
    }
    if (item.status === TransactionStatus.REVIEW) {
      reviewCount += 1;
    }

    if (item.status === TransactionStatus.CLASSIFIED) {
      if (itemDay === today.getTime()) {
        classifiedTodayCount += 1;
        if (amount > 0) {
          todayRevenue += amount;
        }
      }
      if (itemDay === yesterday.getTime()) {
        classifiedYesterdayCount += 1;
        if (amount > 0) {
          yesterdayRevenue += amount;
        }
      }
    }

    if (confidenceScore != null && item.status !== TransactionStatus.PENDING) {
      scoredCount += 1;
      if (confidenceScore >= 85) {
        highConfidenceCount += 1;
      }
    }
  }

  const revenueChangePercent =
    yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

  const classifiedChangePercent =
    classifiedYesterdayCount > 0
      ? ((classifiedTodayCount - classifiedYesterdayCount) / classifiedYesterdayCount) * 100
      : null;

  const aiAccuracyPercent = scoredCount > 0 ? (highConfidenceCount / scoredCount) * 100 : null;

  return {
    todayRevenue,
    yesterdayRevenue,
    revenueChangePercent,
    pendingCount,
    reviewCount,
    classifiedTodayCount,
    classifiedYesterdayCount,
    classifiedChangePercent,
    aiAccuracyPercent,
  };
}
