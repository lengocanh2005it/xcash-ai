import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, SubscriptionPlan, TransactionDirection, TransactionSource } from '@prisma/client';
import type { Queue } from 'bullmq';
import { isOveragePlan } from '../../common/constants/quota-policy';
import { QuotaNotificationService } from '../../common/services/quota-notification.service';
import { createAuditLog } from '../../common/util/audit-log.util';
import { verifyWebhookSignature } from '../../common/util/webhook-signature.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import { AI_CLASSIFY_JOB } from '../ai/classification.constants';
import type { CasWebhookDto } from './dto/banking.dto';

export interface CasWebhookResult {
  duplicate: boolean;
  transactionId: string;
  tenantId?: string;
  status?: string;
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
    private readonly quotaNotificationService: QuotaNotificationService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  verifyWebhookSignature(
    rawBody: string,
    signatureHeader?: string,
    timestampHeader?: string,
  ): void {
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

    const casDirection = txn.amount >= 0 ? 'in' : 'out';

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
      const subscription = await tx.subscription.findFirst({
        where: { tenantId: grant.tenantId, status: 'active' },
      });

      if (!subscription) {
        throw new NotFoundException('Không tìm thấy subscription active cho tenant');
      }

      const isOverQuota = subscription.transactionUsedThisCycle >= subscription.transactionQuota;

      if (isOverQuota && subscription.plan === SubscriptionPlan.free) {
        throw new ForbiddenException('Đã hết quota tháng này. Vui lòng nâng cấp gói.');
      }

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
          status: 'pending',
          source: TransactionSource.cas,
          direction: casDirection === 'in' ? TransactionDirection.in : TransactionDirection.out,
        },
      });

      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          transactionUsedThisCycle: { increment: 1 },
        },
      });

      // Chỉ log overage cho Starter/Pro — Free bị chặn ở trên, Enterprise không tính phí vượt
      if (isOverQuota && isOveragePlan(subscription.plan)) {
        await tx.usageLog.create({
          data: {
            tenantId: grant.tenantId,
            metric: 'overage_transaction',
            value: new Prisma.Decimal(1),
          },
        });
      }

      await createAuditLog(tx, {
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
      });

      return { transaction, subscription };
    });

    const { transaction: savedTx, subscription: currentSubscription } = saved;

    await this.webhookQueue.add(AI_CLASSIFY_JOB, { transactionDbId: savedTx.id });

    void this.quotaNotificationService
      .checkAndNotify({
        tenantId: grant.tenantId,
        oldUsed: currentSubscription.transactionUsedThisCycle - 1,
        quota: currentSubscription.transactionQuota,
        plan: currentSubscription.plan,
        overagePricePerTransaction: currentSubscription.overagePricePerTransaction
          ? Number(currentSubscription.overagePricePerTransaction)
          : null,
        cycleStart: currentSubscription.currentCycleStart,
        added: 1,
      })
      .catch((err: unknown) =>
        this.logger.warn(`Quota notification failed for tenant ${grant.tenantId}`, err),
      );

    return {
      duplicate: false,
      transactionId,
      tenantId: savedTx.tenantId,
      status: savedTx.status,
    };
  }
}
