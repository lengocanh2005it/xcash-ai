import type { TransactionStatus } from '@xcash/shared-types';

export interface TransactionClassificationSummary {
  debitAccount: string;
  creditAccount: string;
  confidenceScore: number;
  classificationType: string;
  status: string;
  reason: string | null;
}

export interface TransactionSummary {
  id: string;
  transactionId: string;
  amount: string;
  content: string | null;
  senderAccount: string | null;
  status: TransactionStatus | string;
  confidenceScore: number | null;
  transactionDate: string;
  source?: 'cas' | 'import';
  direction?: 'in' | 'out';
  classification?: TransactionClassificationSummary | null;
}

export interface TransactionDetail extends TransactionSummary {
  grantId: string | null;
  receiverAccount: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionListResponse {
  items: TransactionSummary[];
  page: number;
  limit: number;
  total: number;
}
