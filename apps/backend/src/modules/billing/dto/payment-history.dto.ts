import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaymentHistoryDto {
  @IsOptional()
  @IsIn(['upgrade', 'overage'])
  orderType?: 'upgrade' | 'overage';

  @IsOptional()
  @IsIn(['pending', 'paid', 'failed', 'expired'])
  status?: 'pending' | 'paid' | 'failed' | 'expired';

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;
}
