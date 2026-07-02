export interface TransactionSummary {
  id: string;
  transactionId: string;
  amount: string;
  content: string | null;
  status: string;
  transactionDate: string;
}

export interface TransactionListResponse {
  items: TransactionSummary[];
  total: number;
}
