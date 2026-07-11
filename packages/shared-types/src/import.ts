import type { TransactionDirection } from './generated/enums';

export interface ImportValidateResult {
  valid: boolean;
  totalRows: number;
  errorCount?: number;
  errors?: Array<{
    row: number;
    column?: string;
    value?: string;
    message: string;
  }>;
  warnings?: Array<{ row: number; message: string }>;
  quotaImpact?: {
    willUse: number;
    remaining: number;
    willExceedQuota: boolean;
  };
  preview?: Array<{
    row: number;
    date: string;
    description: string;
    amount: number;
    direction: TransactionDirection;
  }>;
}

export interface ImportResult {
  batchId: string;
  imported: number;
  skipped: number;
  skippedReasons?: Array<{ row: number; reason: string }>;
  quotaWarning?: string;
}

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  importedByName: string;
  createdAt: string;
}
