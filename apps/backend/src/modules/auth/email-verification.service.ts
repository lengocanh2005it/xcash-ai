import { randomInt } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { throwOtpCooldownException } from '../../common/util/otp-cooldown.util';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import {
  EMAIL_JOB_OPTIONS,
  EMAIL_OTP_JOB,
  type EmailOtpJobData,
} from '../notification/email.constants';

interface StoredOtpPayload {
  otp: string;
  userId: string;
  attempts: number;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly otpTtlSeconds: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailOtpJobData>,
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

  async sendOtp(email: string, userId: string, ownerName: string): Promise<number> {
    const normalizedEmail = email.toLowerCase();
    await this.assertResendAllowed(normalizedEmail);

    const otp = this.generateOtp();
    const payload: StoredOtpPayload = { otp, userId, attempts: 0 };

    await this.redisService.set(
      this.otpKey(normalizedEmail),
      JSON.stringify(payload),
      'EX',
      this.otpTtlSeconds,
    );
    await this.redisService.set(
      this.resendKey(normalizedEmail),
      '1',
      'EX',
      this.resendCooldownSeconds,
    );

    const jobData: EmailOtpJobData = {
      to: normalizedEmail,
      ownerName,
      otp,
    };

    await this.emailQueue.add(EMAIL_OTP_JOB, jobData, EMAIL_JOB_OPTIONS);
    this.logger.log(`Queued verification OTP email for ${normalizedEmail}`);

    return this.otpTtlSeconds;
  }

  async verifyOtp(email: string, otp: string): Promise<string> {
    const normalizedEmail = email.toLowerCase();
    const raw = await this.redisService.get(this.otpKey(normalizedEmail));

    if (!raw) {
      throw new BadRequestException('Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã.');
    }

    const payload = JSON.parse(raw) as StoredOtpPayload;

    if (payload.attempts >= this.maxAttempts) {
      await this.redisService.del(this.otpKey(normalizedEmail));
      throw new BadRequestException('Đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã OTP.');
    }

    if (payload.otp !== otp) {
      payload.attempts += 1;
      const ttl = await this.redisService.ttl(this.otpKey(normalizedEmail));
      if (ttl > 0) {
        await this.redisService.set(
          this.otpKey(normalizedEmail),
          JSON.stringify(payload),
          'EX',
          ttl,
        );
      }
      throw new BadRequestException('Mã OTP không đúng');
    }

    await this.redisService.del(this.otpKey(normalizedEmail));
    return payload.userId;
  }

  private async assertResendAllowed(email: string): Promise<void> {
    const cooldown = await this.redisService.get(this.resendKey(email));
    if (cooldown) {
      const ttl = await this.redisService.ttl(this.resendKey(email));
      throwOtpCooldownException(ttl);
    }
  }

  private generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private otpKey(email: string): string {
    return `email_verify_otp:${email}`;
  }

  private resendKey(email: string): string {
    return `email_verify_resend:${email}`;
  }
}
