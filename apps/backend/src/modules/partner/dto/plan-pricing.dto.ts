import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export class SetTenantPlanDto {
  @IsEnum(['free', 'starter', 'pro', 'enterprise'])
  targetPlan: string;
}

export class UpdatePlanPricingDto {
  @IsNumber()
  @Min(0)
  pricePerMonth: number;

  @IsNumber()
  @Min(1)
  transactionQuota: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  overagePricePerTransaction?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  copilotQuota?: number;
}
