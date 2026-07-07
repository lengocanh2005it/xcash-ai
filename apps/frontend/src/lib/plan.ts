import { SubscriptionPlan } from '@xcash/shared-types';

/** Thứ bậc gói dịch vụ để so sánh quyền truy cập tính năng theo tier. */
export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.FREE]: 0,
  [SubscriptionPlan.STARTER]: 1,
  [SubscriptionPlan.PRO]: 2,
  [SubscriptionPlan.ENTERPRISE]: 3,
};

export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  [SubscriptionPlan.FREE]: 'Free',
  [SubscriptionPlan.STARTER]: 'Starter',
  [SubscriptionPlan.PRO]: 'Pro',
  [SubscriptionPlan.ENTERPRISE]: 'Enterprise',
};

/** True nếu gói hiện tại đủ cao (>=) so với gói tối thiểu yêu cầu. */
export function hasPlanAccess(
  current: SubscriptionPlan | null | undefined,
  required: SubscriptionPlan,
): boolean {
  if (!current) return false;
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

/** Copilot quota mặc định theo spec (khớp migration seed). */
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

/** `-1` = unlimited; `0` = không có Copilot (Free). */
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
