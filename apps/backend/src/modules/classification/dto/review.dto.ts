import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CorrectClassificationDto {
  @IsString()
  @MinLength(2)
  debitAccount!: string;

  @IsString()
  @MinLength(2)
  creditAccount!: string;
}

export class ConfirmClassificationDto {
  @IsOptional()
  @IsIn(['copilot'])
  source?: 'copilot';
}
