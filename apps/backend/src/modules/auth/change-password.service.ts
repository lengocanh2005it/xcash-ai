import { randomInt } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { throwOtpCooldownException } from '../../common/util/otp-cooldown.util';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import {
  EMAIL_CHANGE_PASSWORD_OTP_JOB,
  EMAIL_JOB_OPTIONS,
  type EmailChangePasswordOtpJobData,
} from '../notification/email.constants';

interface StoredChangePasswordPayload {
  otp: string;
  userId: string;
  email: string;
  userName: string;
  newPasswordHash: string;
  attempts: number;
}

@Injectable()
export class ChangePasswordService {
  private readonly logger = new Logger(ChangePasswordService.name);
  private readonly otpTtlSeconds: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailChangePasswordOtpJobData>,
  ) {
    this.otpTtlSeconds = Number.parseInt(
      this.configService.get<string>('EMAIL_OTP_TTL_SECONDS', '600'),
      10,
    );
    this.resendCooldownSeconds = Number.parseInt(
      this.configService.get<string>('EMAIL_OTP_RESEND_COOLDOWN_SECONDS', '60'),
      10,
    );
    this.maxAttempts = Number.parseInt(
      this.configService.get<string>('EMAIL_OTP_MAX_ATTEMPTS', '5'),
      10,
    );
  }

  async initiate(
    userId: string,
    email: string,
    userName: string,
    newPasswordHash: string,
  ): Promise<number> {
    const normalizedEmail = email.toLowerCase();
    await this.assertResendAllowed(userId);

    const otp = this.generateOtp();
    const payload: StoredChangePasswordPayload = {
      otp,
      userId,
      email: normalizedEmail,
      userName,
      newPasswordHash,
      attempts: 0,
    };

    await this.redisService.set(
      this.otpKey(userId),
      JSON.stringify(payload),
      'EX',
      this.otpTtlSeconds,
    );
    await this.redisService.set(this.resendKey(userId), '1', 'EX', this.resendCooldownSeconds);

    await this.emailQueue.add(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      { to: normalizedEmail, userName, otp },
      EMAIL_JOB_OPTIONS,
    );
    this.logger.log(`Queued change-password OTP email for ${normalizedEmail}`);

    return this.otpTtlSeconds;
  }

  async resend(userId: string): Promise<number> {
    const raw = await this.redisService.get(this.otpKey(userId));
    if (!raw) {
      throw new BadRequestException(
        'Không có yêu cầu đổi mật khẩu đang chờ. Vui lòng nhập lại mật khẩu.',
      );
    }

    const existing = JSON.parse(raw) as StoredChangePasswordPayload;
    await this.assertResendAllowed(userId);

    const otp = this.generateOtp();
    const payload: StoredChangePasswordPayload = {
      ...existing,
      otp,
      attempts: 0,
    };

    await this.redisService.set(
      this.otpKey(userId),
      JSON.stringify(payload),
      'EX',
      this.otpTtlSeconds,
    );
    await this.redisService.set(this.resendKey(userId), '1', 'EX', this.resendCooldownSeconds);

    await this.emailQueue.add(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      { to: existing.email, userName: existing.userName, otp },
      EMAIL_JOB_OPTIONS,
    );

    return this.otpTtlSeconds;
  }

  async verifyAndConsume(userId: string, otp: string): Promise<string> {
    const raw = await this.redisService.get(this.otpKey(userId));

    if (!raw) {
      throw new BadRequestException('Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã.');
    }

    const payload = JSON.parse(raw) as StoredChangePasswordPayload;

    if (payload.userId !== userId) {
      throw new NotFoundException('Yêu cầu đổi mật khẩu không hợp lệ');
    }

    if (payload.attempts >= this.maxAttempts) {
      await this.redisService.del(this.otpKey(userId));
      throw new BadRequestException('Đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã OTP.');
    }

    if (payload.otp !== otp) {
      payload.attempts += 1;
      const ttl = await this.redisService.ttl(this.otpKey(userId));
      if (ttl > 0) {
        await this.redisService.set(this.otpKey(userId), JSON.stringify(payload), 'EX', ttl);
      }
      throw new BadRequestException('Mã OTP không đúng');
    }

    await this.redisService.del(this.otpKey(userId));
    return payload.newPasswordHash;
  }

  private async assertResendAllowed(userId: string): Promise<void> {
    const cooldown = await this.redisService.get(this.resendKey(userId));
    if (cooldown) {
      const ttl = await this.redisService.ttl(this.resendKey(userId));
      throwOtpCooldownException(ttl);
    }
  }

  private generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private otpKey(userId: string): string {
    return `change_password_otp:${userId}`;
  }

  private resendKey(userId: string): string {
    return `change_password_resend:${userId}`;
  }
}
