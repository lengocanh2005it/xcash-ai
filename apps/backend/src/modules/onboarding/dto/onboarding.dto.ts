import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class BankingCallbackDto {
  @ApiProperty({ description: 'publicToken từ Cas Link redirect' })
  @IsString()
  @MinLength(1)
  publicToken!: string;
}

export class GrantTokenQueryDto {
  @ApiPropertyOptional({ example: 'identity,transaction', default: 'identity,transaction' })
  @IsOptional()
  @IsString()
  scopes?: string;
}
