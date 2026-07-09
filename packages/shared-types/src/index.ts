// Shared enums & types between @xcash/backend and @xcash/frontend.

// ─── Re-export enums from generated file (source of truth: Prisma schema) ─
export {
  AccountType,
  AiCallType,
  CasGrantStatus,
  ClassificationType,
  CopilotMessageRole,
  NotificationType,
  PaymentOrderStatus,
  Role,
  SubscriptionPlan,
  SubscriptionStatus,
  TransactionDirection,
  TransactionSource,
  TransactionStatus,
} from './generated/enums';

// ─── Plan utilities ──────────────────────────────────────────────────────
import type { NotificationType, SubscriptionPlan, TransactionDirection } from './generated/enums';

/** Thứ bậc gói dịch vụ — dùng để so sánh quyền truy cập tính năng theo tier. */
export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

/** True nếu gói hiện tại đủ cao (>=) so với gói tối thiểu yêu cầu. */
export function meetsPlan(
  current: SubscriptionPlan | null | undefined,
  required: SubscriptionPlan,
): boolean {
  if (!current) return false;
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

// ─── Interfaces ──────────────────────────────────────────────────────────
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  items: AppNotification[];
  unreadCount: number;
  total: number;
}

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

export interface CopilotConfirmActionCardData {
  tool: 'propose_confirm_transaction_classification';
  transactionId: string;
  classificationId: string;
  debitAccount: string;
  creditAccount: string;
  confidence: number;
  status: string;
  content: string;
  amount: number;
  canConfirm: boolean;
  reason?: string;
}

export interface CopilotCorrectActionCardData {
  tool: 'propose_correct_transaction_classification';
  transactionId: string;
  classificationId: string;
  debitAccount: string;
  creditAccount: string;
  proposedDebitAccount: string;
  proposedCreditAccount: string;
  confidence: number;
  status: string;
  content: string;
  amount: number;
  canCorrect: boolean;
  reason?: string;
}

export type CopilotActionCardData = CopilotConfirmActionCardData | CopilotCorrectActionCardData;

export interface CopilotActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search' | 'action_card';
  label: string;
  source?: string;
  urls?: string[];
  snippet?: string;
  actionCard?: CopilotActionCardData;
}

export interface CopilotConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface CopilotMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  activities?: CopilotActivity[];
  createdAt: string;
  isPartial: boolean;
}

export interface CopilotConversationDetail {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: CopilotMessageDto[];
  hasMore: boolean;
  oldestMessageId: string | null;
}

export interface CopilotConversationsListResponse {
  items: CopilotConversationSummary[];
  hasMore: boolean;
  cursorNext: string | null;
  /** Offset pagination (Settings history tab) */
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  meta?: {
    timestamp: string;
    request_id: string;
    page?: number;
    limit?: number;
    total?: number;
  };
  error: { code: string; message: string } | null;
}
