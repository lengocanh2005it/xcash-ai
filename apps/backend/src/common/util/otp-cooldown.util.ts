import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Throw a 429 Too Many Requests error for OTP resend cooldown.
 * Shared across email-verification, password-reset, and change-password services.
 */
export function throwOtpCooldownException(ttl: number): never {
  throw new HttpException(
    `Vui lòng đợi ${Math.max(ttl, 1)} giây trước khi gửi lại mã OTP`,
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
