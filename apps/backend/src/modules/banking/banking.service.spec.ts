import { createHmac } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlan, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BankingService } from './banking.service';

describe('BankingService', () => {
  let service: BankingService;

  const redisClient = {
    set: jest.fn(),
  };

  const prisma = {
    casGrant: {
      findUnique: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
    transaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const configValues: Record<string, string> = {
    WEBHOOK_SKIP_SIGNATURE_VERIFY: 'true',
    WEBHOOK_IDEMPOTENCY_TTL_SECONDS: '86400',
    CAS_SECRET_KEY: 'test-secret',
    WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS: '300',
  };

  const payload = {
    webhookType: 'TRANSACTIONS',
    grantId: 'grant-1',
    transaction: {
      id: 'txn-1',
      amount: 100000,
      description: 'Test payment',
      transactionDateTime: '2026-07-01T10:00:00.000Z',
      counterAccountName: 'Nguyen Van A',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankingService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { client: redisClient } },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => configValues[key] ?? defaultValue,
          },
        },
      ],
    }).compile();

    service = module.get<BankingService>(BankingService);
  });

  it('returns probe result when Cas Console pings without transaction payload', async () => {
    const result = await service.handleCasWebhook({ webhookType: 'TRANSACTIONS' });

    expect(result).toEqual({ probe: true, ok: true });
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it('returns duplicate when redis idempotency key already exists', async () => {
    redisClient.set.mockResolvedValue(null);

    const result = await service.handleCasWebhook(payload);

    expect(result).toEqual({ duplicate: true, transactionId: 'txn-1' });
    expect(prisma.casGrant.findUnique).not.toHaveBeenCalled();
  });

  it('blocks free plan when quota is exceeded', async () => {
    redisClient.set.mockResolvedValue('OK');
    prisma.casGrant.findUnique.mockResolvedValue({
      grantId: 'grant-1',
      tenantId: 'tenant-1',
    });
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      tenantId: 'tenant-1',
      plan: SubscriptionPlan.free,
      transactionQuota: 100,
      transactionUsedThisCycle: 100,
    });

    await expect(service.handleCasWebhook(payload)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('saves transaction and increments usage on happy path', async () => {
    redisClient.set.mockResolvedValue('OK');
    prisma.casGrant.findUnique.mockResolvedValue({
      grantId: 'grant-1',
      tenantId: 'tenant-1',
    });
    prisma.subscription.findFirst.mockResolvedValue({
      id: 'sub-1',
      tenantId: 'tenant-1',
      plan: SubscriptionPlan.free,
      transactionQuota: 100,
      transactionUsedThisCycle: 10,
    });
    prisma.transaction.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: {
          create: jest.fn().mockResolvedValue({
            id: 'db-txn-1',
            tenantId: 'tenant-1',
            status: TransactionStatus.pending,
          }),
        },
        subscription: {
          update: jest.fn().mockResolvedValue({}),
        },
        usageLog: {
          create: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
      }),
    );

    const result = await service.handleCasWebhook(payload);

    expect(result).toEqual({
      duplicate: false,
      transactionId: 'txn-1',
      tenantId: 'tenant-1',
      status: TransactionStatus.pending,
    });
    expect(redisClient.set).toHaveBeenCalledWith('webhook:cas:txn:txn-1', '1', 'EX', 86400, 'NX');
  });

  it('rejects invalid webhook signature when verify is enabled', () => {
    configValues.WEBHOOK_SKIP_SIGNATURE_VERIFY = 'false';
    const rawBody = JSON.stringify(payload);
    const signature = createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

    expect(() => service.verifyWebhookSignature(rawBody, `sha256=${signature}`)).not.toThrow();

    expect(() => service.verifyWebhookSignature(rawBody, 'sha256=invalid')).toThrow(
      UnauthorizedException,
    );

    configValues.WEBHOOK_SKIP_SIGNATURE_VERIFY = 'true';
  });
});
