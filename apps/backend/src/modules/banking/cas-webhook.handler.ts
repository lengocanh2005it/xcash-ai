import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyWebhookSignature } from '../../common/util/webhook-signature.util';
import type { CasWebhookDto } from './dto/banking.dto';

export interface CasWebhookPayload {
  /** Transaction ID from Cas (empty string if probe) */
  transactionId: string;
  /** Grant ID (empty string if probe) */
  grantId: string;
  /** Transaction amount (0 if probe) */
  amount: number;
  /** Transaction description */
  description: string;
  /** ISO datetime string */
  transactionDateTime: string;
  /** Counter-party account name */
  counterAccountName: string;
  /** Cas partner name */
  fiName: string;
  /** Whether this is a probe (no transaction payload) */
  isProbe: boolean;
}

/**
 * Handles webhook intake layer: signature verification + payload parsing.
 * Separates adapter concerns from business logic in BankingService.
 */
@Injectable()
export class CasWebhookHandler {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Verify webhook signature using HMAC-SHA256.
   * Throws UnauthorizedException on failure.
   */
  verifySignature(rawBody: string, signatureHeader?: string, timestampHeader?: string): void {
    const skipVerify = this.configService.get<string>('WEBHOOK_SKIP_SIGNATURE_VERIFY') === 'true';
    const secret = this.configService.get<string>('CAS_SECRET_KEY', '');
    const toleranceSeconds = Number.parseInt(
      this.configService.get<string>('WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS', '300'),
      10,
    );

    verifyWebhookSignature({
      rawBody,
      signatureHeader,
      timestampHeader,
      skipVerify,
      secret,
      toleranceSeconds,
    });
  }

  /**
   * Parse raw webhook DTO into a typed CasWebhookPayload.
   * Returns null if the payload is a probe (no transaction).
   */
  parsePayload(dto: CasWebhookDto): CasWebhookPayload | null {
    if (!dto?.transaction?.id) {
      return null;
    }

    const txn = dto.transaction;
    return {
      transactionId: txn.id,
      grantId: dto.grantId ?? '',
      amount: txn.amount,
      description: txn.description ?? '',
      transactionDateTime: txn.transactionDateTime,
      counterAccountName: txn.counterAccountName ?? '',
      fiName: txn.fiName ?? '',
      isProbe: false,
    };
  }
}
