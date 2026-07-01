import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class CasWebhookTransactionDto {
  @IsString()
  id!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  transactionDateTime!: string;

  @IsOptional()
  @IsString()
  counterAccountName?: string;

  @IsOptional()
  @IsString()
  fiName?: string;
}

export class CasWebhookDto {
  @IsOptional()
  @IsString()
  webhookType?: string;

  @IsOptional()
  @IsString()
  grantId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CasWebhookTransactionDto)
  transaction?: CasWebhookTransactionDto;
}
