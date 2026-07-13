import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { throwOtpCooldownException } from '../util/otp-cooldown.util';

interface OtpEnvelope<T> {
  otp: string;
  attempts: number;
  payload: T;
}

/**
 * Shared OTP state machine (generate → store → cooldown-gated resend →
 * attempt-tracked verify → consume) used by email verification, password
 * reset, and change-password. Each caller supplies its own payload shape
 * and a `prefix` + `identifier` pair that map onto the same Redis key
 * format each of those flows already used before this extraction:
 * `${prefix}_otp:${identifier}` / `${prefix}_resend:${identifier}`.
 */
@Injectable()
export class OtpFlowService {
  private readonly otpTtlSeconds: number;
  private readonly resendCooldownSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
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

  /**
   * Cooldown-gates, generates a fresh OTP, and stores `payload` alongside it.
   * Returns the generated code (the caller must email it — this service never
   * sends email itself) and the TTL in seconds.
   */
  async send<T>(
    prefix: string,
    identifier: string,
    payload: T,
  ): Promise<{ otp: string; ttlSeconds: number }> {
    await this.assertResendAllowed(prefix, identifier);

    const otp = this.generateOtp();
    const envelope: OtpEnvelope<T> = { otp, attempts: 0, payload };
    await this.redisService.set(
      this.otpKey(prefix, identifier),
      JSON.stringify(envelope),
      'EX',
      this.otpTtlSeconds,
    );
    await this.redisService.set(
      this.resendKey(prefix, identifier),
      '1',
      'EX',
      this.resendCooldownSeconds,
    );

    return { otp, ttlSeconds: this.otpTtlSeconds };
  }

  /** Reads the stored payload without consuming it — for flows that need to re-send using previously stored data. */
  async peek<T>(prefix: string, identifier: string): Promise<T | undefined> {
    const raw = await this.redisService.get(this.otpKey(prefix, identifier));
    if (!raw) return undefined;
    return (JSON.parse(raw) as OtpEnvelope<T>).payload;
  }

  /** Verifies `code`, tracking wrong attempts and deleting the OTP on success. Returns the stored payload. */
  async verify<T>(prefix: string, identifier: string, code: string): Promise<T> {
    const key = this.otpKey(prefix, identifier);
    const raw = await this.redisService.get(key);

    if (!raw) {
      throw new BadRequestException('Mã OTP đã hết hạn hoặc không tồn tại. Vui lòng gửi lại mã.');
    }

    const envelope = JSON.parse(raw) as OtpEnvelope<T>;

    if (envelope.attempts >= this.maxAttempts) {
      await this.redisService.del(key);
      throw new BadRequestException('Đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã OTP.');
    }

    if (envelope.otp !== code) {
      envelope.attempts += 1;
      const ttl = await this.redisService.ttl(key);
      if (ttl > 0) {
        await this.redisService.set(key, JSON.stringify(envelope), 'EX', ttl);
      }
      throw new BadRequestException('Mã OTP không đúng');
    }

    await this.redisService.del(key);
    return envelope.payload;
  }

  private async assertResendAllowed(prefix: string, identifier: string): Promise<void> {
    const key = this.resendKey(prefix, identifier);
    const cooldown = await this.redisService.get(key);
    if (cooldown) {
      const ttl = await this.redisService.ttl(key);
      throwOtpCooldownException(ttl);
    }
  }

  private generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private otpKey(prefix: string, identifier: string): string {
    return `${prefix}_otp:${identifier}`;
  }

  private resendKey(prefix: string, identifier: string): string {
    return `${prefix}_resend:${identifier}`;
  }
}
