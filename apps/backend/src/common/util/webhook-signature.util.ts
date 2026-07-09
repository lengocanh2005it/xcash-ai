import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

export interface VerifyWebhookSignatureOptions {
  rawBody: string;
  signatureHeader?: string;
  timestampHeader?: string;
  skipVerify?: boolean;
  secret: string;
  toleranceSeconds?: number;
}

export function verifyWebhookSignature(options: VerifyWebhookSignatureOptions): void {
  const {
    rawBody,
    signatureHeader,
    timestampHeader,
    skipVerify = false,
    secret,
    toleranceSeconds = 300,
  } = options;

  if (skipVerify) {
    return;
  }

  if (!signatureHeader) {
    throw new UnauthorizedException('Thiếu chữ ký webhook');
  }

  if (timestampHeader) {
    const timestamp = Number.parseInt(timestampHeader, 10);
    if (!Number.isNaN(timestamp)) {
      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > toleranceSeconds) {
        throw new UnauthorizedException('Webhook timestamp không hợp lệ');
      }
    }
  }

  if (!secret) {
    throw new UnauthorizedException('Chưa cấu hình secret key để verify webhook');
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');

  try {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const providedBuffer = Buffer.from(provided, 'hex');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }
  } catch {
    throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
  }
}
