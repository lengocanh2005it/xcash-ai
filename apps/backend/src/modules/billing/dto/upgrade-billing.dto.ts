import type { SubscriptionPlan } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpgradeBillingDto {
  @IsEnum(['free', 'starter', 'pro', 'enterprise'])
  targetPlan!: SubscriptionPlan;
}
