import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;

export class CreateAccountDto {
  @IsString()
  @MinLength(2)
  accountCode!: string;

  @IsString()
  @MinLength(2)
  accountName!: string;

  @IsIn(ACCOUNT_TYPES)
  accountType!: string;

  @IsOptional()
  @IsString()
  parentCode?: string;
}

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  accountName?: string;

  @IsOptional()
  @IsIn(ACCOUNT_TYPES)
  accountType?: string;

  @IsOptional()
  @IsString()
  parentCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
