import type { SubscriptionPlan } from '@prisma/client';

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
