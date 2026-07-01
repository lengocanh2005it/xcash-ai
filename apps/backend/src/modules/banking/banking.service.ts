import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionPlan, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { CasWebhookDto } from './dto/banking.dto';

export interface CasWebhookResult {
  duplicate: boolean;
  transactionId: string;
  tenantId?: string;
  status?: TransactionStatus;
}

export interface CasWebhookProbeResult {
  probe: true;
  ok: true;
}

@Injectable()
export class BankingService {
  private readonly logger = new Logger(BankingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  verifyWebhookSignature(
    rawBody: string,
    signatureHeader?: string,
    timestampHeader?: string,
  ): void {
    const skipVerify = this.configService.get<string>('WEBHOOK_SKIP_SIGNATURE_VERIFY') === 'true';
    if (skipVerify) {
      this.logger.warn('WEBHOOK_SKIP_SIGNATURE_VERIFY=true — bỏ qua verify chữ ký webhook');
      return;
    }

    if (!signatureHeader) {
      throw new UnauthorizedException('Thiếu chữ ký webhook');
    }

    const toleranceSeconds = Number.parseInt(
      this.configService.get<string>('WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS', '300'),
      10,
    );

    if (timestampHeader) {
      const timestamp = Number.parseInt(timestampHeader, 10);
      if (!Number.isNaN(timestamp)) {
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) > toleranceSeconds) {
          throw new UnauthorizedException('Webhook timestamp không hợp lệ');
        }
      }
    }

    const secret = this.configService.get<string>('CAS_SECRET_KEY', '');
    if (!secret) {
      throw new UnauthorizedException('Chưa cấu hình CAS_SECRET_KEY để verify webhook');
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

  async handleCasWebhook(
    payload: CasWebhookDto,
  ): Promise<CasWebhookResult | CasWebhookProbeResult> {
    if (!payload?.transaction?.id) {
      this.logger.log('Cas webhook probe received (no transaction) — endpoint reachable');
      return { probe: true, ok: true };
    }

    const txn = payload.transaction;

    if (!payload.grantId) {
      throw new BadRequestException('Thiếu grantId trong payload webhook giao dịch');
    }

    const transactionId = txn.id;
    const idempotencyTtl = Number.parseInt(
      this.configService.get<string>('WEBHOOK_IDEMPOTENCY_TTL_SECONDS', '86400'),
      10,
    );
    const idempotencyKey = `webhook:cas:txn:${transactionId}`;

    const acquired = await this.redisService.client.set(
      idempotencyKey,
      '1',
      'EX',
      idempotencyTtl,
      'NX',
    );

    if (!acquired) {
      return { duplicate: true, transactionId };
    }

    const grant = await this.prisma.casGrant.findUnique({
      where: { grantId: payload.grantId },
    });

    if (!grant) {
      throw new NotFoundException('Không tìm thấy tenant cho grantId này');
    }

    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId: grant.tenantId, status: 'active' },
    });

    if (!subscription) {
      throw new NotFoundException('Không tìm thấy subscription active cho tenant');
    }

    const isOverQuota = subscription.transactionUsedThisCycle >= subscription.transactionQuota;

    if (isOverQuota && subscription.plan === SubscriptionPlan.free) {
      throw new ForbiddenException('Đã hết quota tháng này. Vui lòng nâng cấp gói.');
    }

    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { transactionId },
    });

    if (existingTransaction) {
      return {
        duplicate: true,
        transactionId,
        tenantId: existingTransaction.tenantId,
        status: existingTransaction.status,
      };
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          tenantId: grant.tenantId,
          grantId: payload.grantId,
          transactionId,
          amount: new Prisma.Decimal(txn.amount),
          content: txn.description ?? null,
          senderAccount: txn.counterAccountName ?? null,
          receiverAccount: null,
          transactionDate: new Date(txn.transactionDateTime),
          status: TransactionStatus.pending,
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          transactionUsedThisCycle: { increment: 1 },
        },
      });

      if (isOverQuota && subscription.plan !== SubscriptionPlan.free) {
        await tx.usageLog.create({
          data: {
            tenantId: grant.tenantId,
            metric: 'overage_transaction',
            value: new Prisma.Decimal(1),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: grant.tenantId,
          entityType: 'transaction',
          entityId: transaction.id,
          action: 'webhook_received',
          actor: 'system',
          afterState: {
            transactionId,
            grantId: payload.grantId,
            amount: txn.amount,
          },
        },
      });

      return transaction;
    });

    return {
      duplicate: false,
      transactionId,
      tenantId: saved.tenantId,
      status: saved.status,
    };
  }
}
