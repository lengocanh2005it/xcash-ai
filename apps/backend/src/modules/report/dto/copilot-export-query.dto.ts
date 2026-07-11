import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export class CopilotExportQueryDto {
  @IsOptional()
  @IsIn(['excel', 'pdf'])
  format?: 'excel' | 'pdf';

  @IsOptional()
  @IsISO8601({ strict: true })
  fromDate?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  toDate?: string;
}
