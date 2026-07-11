export interface SummaryData {
  period: { year: number; month: number };
  summary: { totalRevenue: number; totalExpense: number; net: number };
  stats: {
    totalCount: number;
    classifiedCount: number;
    reviewCount: number;
    aiAccuracy: number;
  };
}

export interface AccountSummary {
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
  transactionCount: number;
}

export interface AccountBreakdownData {
  items: AccountSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface ComparisonData {
  current: { totalRevenue: number; totalExpense: number; net: number };
  previous: { totalRevenue: number; totalExpense: number; net: number };
  currentStats: {
    totalCount: number;
    classifiedCount: number;
    reviewCount: number;
    aiAccuracy: number;
  };
  previousStats: { aiAccuracy: number };
  changes: { revenue: number; expense: number; net: number; aiAccuracy: number };
}

export interface TopAccountsData {
  topExpense: Array<{ accountCode: string; accountName: string; total: number }>;
  topRevenue: Array<{ accountCode: string; accountName: string; total: number }>;
}
