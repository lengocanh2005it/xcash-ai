import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ImportHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  limit: number = 20;
}
