import { SetMetadata } from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';

export const REQUIRED_PLAN_KEY = 'requiredPlan';

/** Đánh dấu endpoint yêu cầu gói dịch vụ tối thiểu (kết hợp với PlanGuard). */
export const RequiresPlan = (plan: SubscriptionPlan) => SetMetadata(REQUIRED_PLAN_KEY, plan);
