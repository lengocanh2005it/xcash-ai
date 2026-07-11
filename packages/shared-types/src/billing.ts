import type { TransactionSource } from './generated/enums';

export interface PlanData {
  plan: string;
  pricePerMonth: number;
  transactionQuota: number;
  transactionUsed: number;
  currentCycleStart: string;
  currentCycleEnd: string;
  status: string;
  copilotQuota: number;
  copilotUsed: number;
  usageBreakdown?: { fromBank: number; fromImport: number };
}

export interface UpgradeResult {
  orderCode: string;
  checkoutUrl: string;
  qrCode: string;
  amount: number;
  isMock: boolean;
}

export interface OverageOrder {
  orderCode: string;
  amount: number;
  createdAt: string;
}

export interface OveragePaymentResult {
  orderCode: string;
  amount: number;
  overageCount: number;
  checkoutUrl: string | null;
  qrCode: string | null;
  isMock: boolean;
  isExisting: boolean;
}

export interface BillingPlan {
  plan: string;
  pricePerMonth: number;
  transactionQuota: number;
  copilotQuota?: number;
  overagePricePerTransaction: number | null;
}

export interface PaymentOrder {
  id: string;
  orderCode: string;
  orderType: 'upgrade' | 'overage';
  targetPlan: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentHistoryResponse {
  data: PaymentOrder[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface CycleTransaction {
  id: string;
  transactionId: string;
  amount: number;
  content: string;
  transactionDate: string;
  createdAt: string;
  senderAccount: string | null;
  source: TransactionSource;
  classification: {
    debitAccount: string | null;
    creditAccount: string | null;
    status: string;
  } | null;
}
