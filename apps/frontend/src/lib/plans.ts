import { SubscriptionPlan } from '@xcash/shared-types';

export const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'] as const;

export const DEFAULT_COPILOT_QUOTA: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.STARTER]: 200,
  [SubscriptionPlan.PRO]: 1000,
  [SubscriptionPlan.ENTERPRISE]: -1,
};

export function resolveCopilotQuota(
  plan: SubscriptionPlan | string,
  quota?: number | null,
): number {
  if (quota !== undefined && quota !== null) return quota;
  return DEFAULT_COPILOT_QUOTA[plan as SubscriptionPlan] ?? 0;
}

export function formatTransactionQuota(quota: number): string {
  if (quota >= 999_999) return 'Không giới hạn GD';
  return `${quota.toLocaleString('vi-VN')} GD/tháng`;
}

export function formatCopilotQuota(
  quota: number | null | undefined,
  plan?: SubscriptionPlan | string,
): string {
  const value =
    quota !== undefined && quota !== null ? quota : plan ? resolveCopilotQuota(plan, null) : 0;
  if (value === -1) return 'Không giới hạn lượt chat Copilot';
  if (value === 0) return 'Chưa có AI Copilot (cần gói Starter+)';
  return `${value.toLocaleString('vi-VN')} lượt chat Copilot/tháng`;
}
