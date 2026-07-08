import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Max, MaxLength, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListConversationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Max(50)
  declare limit?: number;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}

export class GetConversationQueryDto {
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Max(50)
  declare limit?: number;
}

export class RenameConversationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  title: string;
}
