import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  EMAIL_CHANGE_PASSWORD_OTP_JOB,
  EMAIL_INVITE_JOB,
  EMAIL_MONTHLY_REPORT_JOB,
  EMAIL_OTP_JOB,
  EMAIL_QUEUE,
  EMAIL_RESET_OTP_JOB,
  EMAIL_SEND_JOB,
  type EmailChangePasswordOtpJobData,
  type EmailInviteJobData,
  type EmailJobData,
  type EmailMonthlyReportJobData,
  type EmailOtpJobData,
  type EmailResetOtpJobData,
} from './email.constants';
import { ResendEmailService } from './resend-email.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly resendEmailService: ResendEmailService) {
    super();
  }

  async process(
    job: Job<
      | EmailJobData
      | EmailOtpJobData
      | EmailResetOtpJobData
      | EmailChangePasswordOtpJobData
      | EmailInviteJobData
      | EmailMonthlyReportJobData
    >,
  ): Promise<void> {
    try {
      if (job.name === EMAIL_SEND_JOB) {
        await this.resendEmailService.send(job.data as EmailJobData);
        return;
      }

      if (job.name === EMAIL_OTP_JOB) {
        await this.resendEmailService.sendVerificationOtp(job.data as EmailOtpJobData);
        return;
      }

      if (job.name === EMAIL_RESET_OTP_JOB) {
        await this.resendEmailService.sendPasswordResetOtp(job.data as EmailResetOtpJobData);
        return;
      }

      if (job.name === EMAIL_CHANGE_PASSWORD_OTP_JOB) {
        await this.resendEmailService.sendChangePasswordOtp(
          job.data as EmailChangePasswordOtpJobData,
        );
        return;
      }

      if (job.name === EMAIL_INVITE_JOB) {
        await this.resendEmailService.sendTeamInvite(job.data as EmailInviteJobData);
        return;
      }

      if (job.name === EMAIL_MONTHLY_REPORT_JOB) {
        await this.resendEmailService.sendMonthlyReport(job.data as EmailMonthlyReportJobData);
        return;
      }
    } catch (error) {
      this.logger.error(
        `Email job failed (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}) [${job.name}]`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
