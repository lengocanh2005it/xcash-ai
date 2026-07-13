import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { OtpFlowService } from '../../common/services/otp-flow.service';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import {
  EMAIL_JOB_OPTIONS,
  EMAIL_RESET_OTP_JOB,
  type EmailResetOtpJobData,
} from '../notification/email.constants';

const OTP_PREFIX = 'password_reset';

interface StoredOtpPayload {
  userId: string;
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly otpFlowService: OtpFlowService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailResetOtpJobData>,
  ) {}

  async sendOtp(email: string, userId: string, userName: string): Promise<number> {
    const normalizedEmail = email.toLowerCase();
    const { otp, ttlSeconds } = await this.otpFlowService.send<StoredOtpPayload>(
      OTP_PREFIX,
      normalizedEmail,
      { userId },
    );

    const jobData: EmailResetOtpJobData = { to: normalizedEmail, userName, otp };
    await this.emailQueue.add(EMAIL_RESET_OTP_JOB, jobData, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued password reset OTP email for ${normalizedEmail}`);

    return ttlSeconds;
  }

  async verifyOtp(email: string, otp: string): Promise<string> {
    const normalizedEmail = email.toLowerCase();
    const payload = await this.otpFlowService.verify<StoredOtpPayload>(
      OTP_PREFIX,
      normalizedEmail,
      otp,
    );
    return payload.userId;
  }
}
