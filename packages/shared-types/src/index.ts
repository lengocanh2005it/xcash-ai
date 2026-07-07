// Shared enums & types between @xcash/backend and @xcash/frontend.

export enum Role {
  CAS_PARTNER = 'cas_partner',
  ADMIN = 'admin',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer',
}

export enum TransactionStatus {
  PENDING = 'pending',
  CLASSIFIED = 'classified',
  REVIEW = 'review',
  SKIPPED = 'skipped',
}

export enum ClassificationType {
  AUTO = 'auto',
  MANUAL = 'manual',
}

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export enum CasGrantStatus {
  ACTIVE = 'active',
  INVALIDATED = 'invalidated',
}

export enum SubscriptionPlan {
  FREE = 'free',
  STARTER = 'starter',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
}

export enum PaymentOrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export enum NotificationType {
  REVIEW_NEEDED = 'review_needed',
  QUOTA_WARNING = 'quota_warning',
  QUOTA_EXCEEDED = 'quota_exceeded',
  OVERAGE_STARTED = 'overage_started',
  BILLING_SUCCESS = 'billing_success',
  BILLING_PAYMENT_DUE = 'billing_payment_due',
  TENANT_SUSPENDED = 'tenant_suspended',
}

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

export enum TransactionSource {
  CAS = 'cas',
  IMPORT = 'import',
}

export enum TransactionDirection {
  IN = 'in',
  OUT = 'out',
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

export interface CopilotActivity {
  kind: 'internal_data' | 'knowledge' | 'web_search';
  label: string;
  source?: string;
  urls?: string[];
  snippet?: string;
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
