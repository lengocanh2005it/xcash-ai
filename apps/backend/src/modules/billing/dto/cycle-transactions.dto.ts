import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CycleTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsIn(['cas', 'import'])
  source?: 'cas' | 'import';

  @IsOptional()
  @IsIn(['in', 'out'])
  direction?: 'in' | 'out';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
