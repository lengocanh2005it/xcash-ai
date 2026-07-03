import { IsBoolean, IsEmail, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateThresholdDto {
  @IsNumber()
  @Min(50)
  @Max(99)
  threshold: number;
}

export class UpdateNotificationsDto {
  @IsBoolean()
  emailEnabled: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsBoolean()
  slackEnabled: boolean;

  @IsOptional()
  @IsString()
  slackWebhookUrl?: string;
}
