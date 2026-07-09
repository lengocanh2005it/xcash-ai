import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CycleTransactionsQueryDto extends PaginationQueryDto {
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
