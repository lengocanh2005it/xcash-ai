/**
 * @deprecated Import from '@/lib/dashboard-utils' or '@/lib/transaction-format' instead.
 * This file re-exports everything for backward compatibility.
 */
export {
  buildDailyRevenueTrend,
  buildDailyTransactionTrend,
  buildDashboardOverviewStats,
  buildTransactionStatusBreakdown,
  type DailyTransactionTrendPoint,
  type DailyTrendApiResponse,
  type DashboardOverviewStats,
  type DonutSlice,
  getTransactionConfidenceScore,
  mapDailyTrendResponse,
  mapSourceBreakdownResponse,
  mapStatusBreakdownResponse,
  type SourceBreakdownApiItem,
  type SourceBreakdownApiResponse,
  type StatusBreakdownApiItem,
  type StatusBreakdownApiResponse,
  TRANSACTION_SOURCE_COLORS,
  TRANSACTION_SOURCE_LABELS,
  TRANSACTION_STATUS_COLORS,
  TRANSACTION_STATUS_LABELS,
  type TransactionStatusSlice,
} from './dashboard-utils';

export {
  formatCurrency,
  formatSignedTransactionAmount,
  signedTransactionAmountClassName,
} from './transaction-format';
