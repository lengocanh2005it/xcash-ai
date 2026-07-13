import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { OtpFlowService } from '../../common/services/otp-flow.service';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import {
  EMAIL_CHANGE_PASSWORD_OTP_JOB,
  EMAIL_JOB_OPTIONS,
  type EmailChangePasswordOtpJobData,
} from '../notification/email.constants';

const OTP_PREFIX = 'change_password';

interface StoredChangePasswordPayload {
  userId: string;
  email: string;
  userName: string;
  newPasswordHash: string;
}

@Injectable()
export class ChangePasswordService {
  private readonly logger = new Logger(ChangePasswordService.name);

  constructor(
    private readonly otpFlowService: OtpFlowService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailChangePasswordOtpJobData>,
  ) {}

  async initiate(
    userId: string,
    email: string,
    userName: string,
    newPasswordHash: string,
  ): Promise<number> {
    const normalizedEmail = email.toLowerCase();
    const payload: StoredChangePasswordPayload = {
      userId,
      email: normalizedEmail,
      userName,
      newPasswordHash,
    };
    const { otp, ttlSeconds } = await this.otpFlowService.send(OTP_PREFIX, userId, payload);

    await this.emailQueue.add(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      { to: normalizedEmail, userName, otp },
      EMAIL_JOB_OPTIONS,
    );
    this.logger.log(`Queued change-password OTP email for ${normalizedEmail}`);

    return ttlSeconds;
  }

  async resend(userId: string): Promise<number> {
    const existing = await this.otpFlowService.peek<StoredChangePasswordPayload>(
      OTP_PREFIX,
      userId,
    );
    if (!existing) {
      throw new BadRequestException(
        'Không có yêu cầu đổi mật khẩu đang chờ. Vui lòng nhập lại mật khẩu.',
      );
    }

    const { otp, ttlSeconds } = await this.otpFlowService.send(OTP_PREFIX, userId, existing);

    await this.emailQueue.add(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      { to: existing.email, userName: existing.userName, otp },
      EMAIL_JOB_OPTIONS,
    );

    return ttlSeconds;
  }

  async verifyAndConsume(userId: string, otp: string): Promise<string> {
    const payload = await this.otpFlowService.verify<StoredChangePasswordPayload>(
      OTP_PREFIX,
      userId,
      otp,
    );

    if (payload.userId !== userId) {
      throw new NotFoundException('Yêu cầu đổi mật khẩu không hợp lệ');
    }

    return payload.newPasswordHash;
  }
}
