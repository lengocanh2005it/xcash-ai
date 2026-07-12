import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionDirection, TransactionSource } from '@prisma/client';
import type { Queue } from 'bullmq';
import { createAuditLog } from '../../common/util/audit-log.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import { AI_CLASSIFY_JOB } from '../ai/classification.constants';
import { TransactionQuotaService } from '../billing/transaction-quota.service';
import { OnboardingService } from '../onboarding/onboarding.service';
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
    private readonly transactionQuotaService: TransactionQuotaService,
    private readonly onboardingService: OnboardingService,
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

      const { oldUsed } = await this.transactionQuotaService.incrementUsage(
        tx as any,
        subscription,
        grant.tenantId,
      );

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

      return { transaction, subscription, oldUsed };
    });

    const { transaction: savedTx, subscription: currentSubscription, oldUsed } = saved;

    await this.webhookQueue.add(AI_CLASSIFY_JOB, { transactionDbId: savedTx.id });

    void this.transactionQuotaService
      .notifyAfterBatch(
        {
          transactionUsedThisCycle: oldUsed,
          transactionQuota: currentSubscription.transactionQuota,
          plan: currentSubscription.plan,
          overagePricePerTransaction: currentSubscription.overagePricePerTransaction,
          currentCycleStart: currentSubscription.currentCycleStart,
        },
        grant.tenantId,
        1,
      )
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

  // ── Copilot tool method ──────────────────────────────────────────────────

  async getBankingStatus(tenantId: string) {
    const cacheKey = `copilot:tool:banking:${tenantId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached) as object;

    const status = await this.onboardingService.getStatus(tenantId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [lastCas, countLast7Days] = await Promise.all([
      this.prisma.transaction.findFirst({
        where: { tenantId, grantId: { not: null } },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      }),
      this.prisma.transaction.count({
        where: { tenantId, grantId: { not: null }, transactionDate: { gte: sevenDaysAgo } },
      }),
    ]);

    const payload = {
      bankingLinked: status.bankingLinked,
      grants: status.grants.map((g) => ({
        bankName: g.bankName,
        accountNumber: g.accountNumber,
        linkedAt: g.linkedAt,
        status: g.status,
      })),
      recentCasActivity: {
        lastTransactionAt: lastCas?.transactionDate?.toISOString() ?? null,
        countLast7Days,
      },
      uiHints: {
        settingsBankingPath: '/settings',
        onboardingPath: '/onboarding',
      },
    };

    await this.redisService.set(cacheKey, JSON.stringify(payload), 'EX', 60);
    return payload;
  }
}
