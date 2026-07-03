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
