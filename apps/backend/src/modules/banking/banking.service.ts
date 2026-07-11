import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan, TransactionDirection, TransactionSource } from '@prisma/client';
import type { Queue } from 'bullmq';
import { isOveragePlan } from '../../common/constants/quota-policy';
import { QuotaNotificationService } from '../../common/services/quota-notification.service';
import { createAuditLog } from '../../common/util/audit-log.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import { AI_CLASSIFY_JOB } from '../ai/classification.constants';
import type { CasWebhookPayload } from './cas-webhook.handler';

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
    private readonly quotaNotificationService: QuotaNotificationService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  async handleCasWebhook(
    payload: CasWebhookPayload,
  ): Promise<CasWebhookResult | CasWebhookProbeResult> {
    if (payload.isProbe) {
      this.logger.log('Cas webhook probe received (no transaction) — endpoint reachable');
      return { probe: true, ok: true };
    }

    if (!payload.grantId) {
      throw new BadRequestException('Thiếu grantId trong payload webhook giao dịch');
    }

    const { transactionId, grantId } = payload;
    const idempotencyKey = `webhook:cas:txn:${transactionId}`;
    const idempotencyTtl = 86400;

    const acquired = await this.redisService.set(idempotencyKey, '1', 'EX', idempotencyTtl, 'NX');

    if (!acquired) {
      return { duplicate: true, transactionId };
    }

    const grant = await this.prisma.casGrant.findUnique({
      where: { grantId: payload.grantId },
    });

    if (!grant) {
      throw new NotFoundException('Không tìm thấy tenant cho grantId này');
    }

    const casDirection = payload.amount >= 0 ? 'in' : 'out';

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
          grantId: grantId,
          transactionId,
          amount: new Prisma.Decimal(payload.amount),
          content: payload.description || null,
          senderAccount: payload.counterAccountName || null,
          receiverAccount: null,
          transactionDate: new Date(payload.transactionDateTime),
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
          grantId: grantId,
          amount: payload.amount,
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
