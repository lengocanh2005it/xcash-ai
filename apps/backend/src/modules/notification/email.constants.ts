export { EMAIL_QUEUE } from '../../queue/queue.module';

export const EMAIL_SEND_JOB = 'send-notification-email';
export const EMAIL_OTP_JOB = 'send-verification-otp';
export const EMAIL_RESET_OTP_JOB = 'send-password-reset-otp';
export const EMAIL_CHANGE_PASSWORD_OTP_JOB = 'send-change-password-otp';
export const EMAIL_INVITE_JOB = 'send-team-invite';

export interface EmailJobData {
  tenantId: string;
  to: string;
  subject: string;
  title: string;
  body: string;
  actionUrl: string | null;
}

export interface EmailOtpJobData {
  to: string;
  ownerName: string;
  otp: string;
}

export interface EmailResetOtpJobData {
  to: string;
  userName: string;
  otp: string;
}

export interface EmailChangePasswordOtpJobData {
  to: string;
  userName: string;
  otp: string;
}

export interface EmailInviteJobData {
  to: string;
  inviteeName: string;
  inviterName: string;
  businessName: string;
  roleLabel: string;
  activationUrl: string;
}

export const EMAIL_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 3000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};
