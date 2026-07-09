import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export class UpdateThresholdDto {
  @IsNumber()
  @Min(50)
  @Max(99)
  threshold: number;
}

export class TestSlackWebhookDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  webhookUrl: string;
}

export class UpdateNotificationsDto {
  @IsBoolean()
  emailEnabled: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsBoolean()
  monthlyReportEnabled: boolean;

  @IsOptional()
  @IsEmail()
  monthlyReportEmail?: string;

  @IsBoolean()
  slackEnabled: boolean;

  @IsOptional()
  @IsString()
  slackWebhookUrl?: string;
}
