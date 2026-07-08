import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CycleTransactionsQueryDto extends PaginationQueryDto {
  @IsISO8601()
  cycleStart!: string;

  @IsISO8601()
  cycleEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  limit?: number = 15;
}
