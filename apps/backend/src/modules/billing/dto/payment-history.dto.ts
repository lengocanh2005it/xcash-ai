import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class PaymentHistoryDto extends PaginationQueryDto {
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
}
