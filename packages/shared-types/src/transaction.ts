import type { TransactionDirection, TransactionSource, TransactionStatus } from './generated/enums';

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
  source?: TransactionSource;
  direction?: TransactionDirection;
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
  totalPages?: number;
}

export interface ClassificationItem {
  id: string;
  debitAccount: string;
  creditAccount: string;
  confidenceScore: number;
  reason: string | null;
  transaction: {
    id: string;
    content: string | null;
    amount: string;
    transactionDate: string;
    grantId: string;
  };
}

export interface ReviewQueueResponse {
  data: {
    items: ClassificationItem[];
    total: number;
    page: number;
    limit: number;
  };
}
