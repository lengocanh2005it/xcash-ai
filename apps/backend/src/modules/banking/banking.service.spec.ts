import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlan, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import { TransactionQuotaService } from '../billing/transaction-quota.service';
import { BankingService } from './banking.service';
import type { CasWebhookPayload } from './cas-webhook.handler';
import { CasWebhookHandler } from './cas-webhook.handler';

describe('BankingService', () => {
  let service: BankingService;

  const redisClient = {
    set: jest.fn(),
  };

  const prisma = {
    casGrant: {
      findUnique: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const webhookHandler = {
    verifySignature: jest.fn(),
    parsePayload: jest.fn(),
  };

  const parsedPayload: CasWebhookPayload = {
    transactionId: 'txn-1',
    grantId: 'grant-1',
    amount: 100000,
    description: 'Test payment',
    transactionDateTime: '2026-07-01T10:00:00.000Z',
    counterAccountName: 'Nguyen Van A',
    fiName: 'Test Bank',
    isProbe: false,
  };

  const probePayload: CasWebhookPayload = {
    transactionId: '',
    grantId: '',
    amount: 0,
    description: '',
    transactionDateTime: '',
    counterAccountName: '',
    fiName: '',
    isProbe: true,
  };

  const webhookQueue = {
    add: jest.fn().mockResolvedValue(undefined),
  };

  const transactionQuotaService = {
    incrementUsage: jest.fn().mockResolvedValue({ oldUsed: 10 }),
    notifyAfterBatch: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankingService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redisClient },
        { provide: CasWebhookHandler, useValue: webhookHandler },
        { provide: getQueueToken(WEBHOOK_QUEUE), useValue: webhookQueue },
        { provide: TransactionQuotaService, useValue: transactionQuotaService },
      ],
    }).compile();

    service = module.get<BankingService>(BankingService);
  });

  it('returns probe result when Cas Console pings without transaction payload', async () => {
    const result = await service.handleCasWebhook(probePayload);

    expect(result).toEqual({ probe: true, ok: true });
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('returns duplicate when redis idempotency key already exists', async () => {
    redisClient.set.mockResolvedValue(null);

    const result = await service.handleCasWebhook(parsedPayload);

    expect(result).toEqual({ duplicate: true, transactionId: 'txn-1' });
    expect(prisma.casGrant.findUnique).not.toHaveBeenCalled();
  });

  it('throws when no active subscription found', async () => {
    redisClient.set.mockResolvedValue('OK');
    prisma.casGrant.findUnique.mockResolvedValue({
      grantId: 'grant-1',
      tenantId: 'tenant-1',
    });
    prisma.transaction.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        subscription: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      }),
    );

    await expect(service.handleCasWebhook(parsedPayload)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('delegates quota increment to TransactionQuotaService', async () => {
    redisClient.set.mockResolvedValue('OK');
    prisma.casGrant.findUnique.mockResolvedValue({
      grantId: 'grant-1',
      tenantId: 'tenant-1',
    });
    prisma.transaction.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => {
      const tx = {
        subscription: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'sub-1',
            tenantId: 'tenant-1',
            plan: SubscriptionPlan.free,
            transactionQuota: 100,
            transactionUsedThisCycle: 10,
            overagePricePerTransaction: null,
            currentCycleStart: new Date(),
          }),
        },
        transaction: {
          create: jest.fn().mockResolvedValue({
            id: 'db-txn-1',
            tenantId: 'tenant-1',
            status: TransactionStatus.pending,
          }),
        },
        auditLog: { create: jest.fn() },
      };
      return callback(tx);
    });

    const result = await service.handleCasWebhook(parsedPayload);

    expect(result).toEqual({
      duplicate: false,
      transactionId: 'txn-1',
      tenantId: 'tenant-1',
      status: TransactionStatus.pending,
    });
    expect(transactionQuotaService.incrementUsage).toHaveBeenCalledTimes(1);
    expect(transactionQuotaService.notifyAfterBatch).toHaveBeenCalledTimes(1);
    expect(webhookQueue.add).toHaveBeenCalledWith('ai-classify', { transactionDbId: 'db-txn-1' });
  });
});
