// Shared enums & types between @xcash/backend and @xcash/frontend.
// This barrel re-exports everything for backward compatibility.
// New consumers should prefer sub-path imports (e.g. @xcash/shared-types/auth).

export * from './auth';
export * from './billing';
// ─── Re-export domain modules ─────────────────────────────────────────────
export * from './common';
export * from './copilot';
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
export * from './import';
export * from './notification';
export * from './onboarding';
export * from './partner';
export * from './profile';
export * from './report';
export * from './transaction';
