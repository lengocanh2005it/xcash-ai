import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionStatus } from '@prisma/client';
import { Role } from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../ai/embedding.service';
import { ClassificationService } from './classification.service';

describe('ClassificationService.confirm', () => {
  let service: ClassificationService;

  const auditLogCreate = jest.fn();
  const tx = {
    transactionClassification: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    transaction: { update: jest.fn() },
    auditLog: { create: auditLogCreate },
  };

  const prisma = {
    transactionClassification: { findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => cb(tx)),
  };

  const embeddingService = { embedAndStoreClassification: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => cb(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingService, useValue: embeddingService },
      ],
    }).compile();

    service = module.get(ClassificationService);
  });

  it('throws 404 when classification is not in review queue', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue(null);

    await expect(service.confirm('tenant-1', 'class-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ghi audit log kèm source khi được truyền', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-1',
      transactionId: 'txn-1',
      debitAccount: '642',
      creditAccount: '112',
      transaction: { content: 'Thanh toán điện nước' },
    });

    await service.confirm('tenant-1', 'class-1', 'user-1', 'copilot');

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'review_confirmed',
          afterState: expect.objectContaining({ source: 'copilot' }),
        }),
      }),
    );
  });

  it('không có source trong audit log khi không truyền (hành vi cũ giữ nguyên)', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-1',
      transactionId: 'txn-1',
      debitAccount: '642',
      creditAccount: '112',
      transaction: { content: 'Thanh toán điện nước' },
    });

    await service.confirm('tenant-1', 'class-1', 'user-1');

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          afterState: { action: 'confirm' },
        }),
      }),
    );
  });

  it('throws 409 khi giao dịch đã bị xử lý bởi request khác giữa lúc đọc và lúc ghi (race condition)', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-1',
      transactionId: 'txn-1',
      debitAccount: '642',
      creditAccount: '112',
      transaction: { content: 'Thanh toán điện nước' },
    });
    tx.transactionClassification.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.confirm('tenant-1', 'class-1', 'user-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.transaction.update).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });
});

describe('ClassificationService.correct', () => {
  let service: ClassificationService;

  const auditLogCreate = jest.fn();
  const tx = {
    transactionClassification: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    transaction: { update: jest.fn() },
    auditLog: { create: auditLogCreate },
  };

  const prisma = {
    transactionClassification: { findFirst: jest.fn() },
    $transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) => cb(tx)),
  };

  const embeddingService = { embedAndStoreClassification: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => cb(tx));
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-1',
      transactionId: 'txn-1',
      debitAccount: '642',
      creditAccount: '112',
      transaction: { content: 'Thanh toán điện nước' },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingService, useValue: embeddingService },
      ],
    }).compile();

    service = module.get(ClassificationService);
  });

  it('ghi audit log kèm source khi được truyền', async () => {
    await service.correct('tenant-1', 'class-1', 'user-1', {
      debitAccount: '641',
      creditAccount: '111',
      source: 'copilot',
    });

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'review_corrected',
          afterState: expect.objectContaining({
            debitAccount: '641',
            creditAccount: '111',
            source: 'copilot',
          }),
        }),
      }),
    );
  });

  it('không có source trong audit log khi không truyền (hành vi cũ giữ nguyên)', async () => {
    await service.correct('tenant-1', 'class-1', 'user-1', {
      debitAccount: '641',
      creditAccount: '111',
    });

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          afterState: { debitAccount: '641', creditAccount: '111' },
        }),
      }),
    );
  });

  it('throws 409 khi giao dịch đã bị xử lý bởi request khác giữa lúc đọc và lúc ghi (race condition)', async () => {
    tx.transactionClassification.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.correct('tenant-1', 'class-1', 'user-1', {
        debitAccount: '641',
        creditAccount: '111',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.transaction.update).not.toHaveBeenCalled();
    expect(auditLogCreate).not.toHaveBeenCalled();
  });
});

describe('ClassificationService copilot methods', () => {
  let service: ClassificationService;

  const prisma = {
    transactionClassification: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    chartOfAccount: { findMany: jest.fn() },
  };

  const embeddingService = { embedAndStoreClassification: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmbeddingService, useValue: embeddingService },
      ],
    }).compile();

    service = module.get(ClassificationService);
  });

  describe('getCopilotReviewQueueCount', () => {
    it('returns count with scope=all when no period given', async () => {
      prisma.transactionClassification.count.mockResolvedValue(5);

      const result = await service.getCopilotReviewQueueCount('tenant-1');

      expect(result).toEqual({ count: 5, scope: 'all' });
      expect(prisma.transactionClassification.count).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', status: 'review' },
      });
    });

    it('returns count with period when year+month given', async () => {
      prisma.transactionClassification.count.mockResolvedValue(3);

      const result = await service.getCopilotReviewQueueCount('tenant-1', 2026, 7);

      expect(result).toEqual({ count: 3, period: { year: 2026, month: 7 } });
    });
  });

  describe('listCopilotReviewQueue', () => {
    it('returns mapped items with total', async () => {
      prisma.transactionClassification.findMany.mockResolvedValue([
        {
          transaction: {
            id: 'txn-1',
            content: 'Thanh toán',
            amount: 100000,
            transactionDate: new Date('2026-07-01'),
            grantId: 'grant-1',
          },
          debitAccount: '642',
          creditAccount: '112',
          confidenceScore: 75,
          status: TransactionStatus.review,
        },
      ]);
      prisma.transactionClassification.count.mockResolvedValue(1);

      const result = await service.listCopilotReviewQueue('tenant-1', 10, 2026, 7);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          id: 'txn-1',
          debitAccount: '642',
          creditAccount: '112',
          confidence: 75,
          source: 'cas',
        }),
      );
    });

    it('clamps limit between 1 and 20', async () => {
      prisma.transactionClassification.findMany.mockResolvedValue([]);
      prisma.transactionClassification.count.mockResolvedValue(0);

      await service.listCopilotReviewQueue('tenant-1', 999);

      expect(prisma.transactionClassification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });
  });

  describe('proposeConfirmClassification', () => {
    it('returns not_found when classification does not exist', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue(null);

      const result = await service.proposeConfirmClassification(
        'tenant-1',
        'txn-missing',
        Role.ADMIN,
      );

      expect(result.status).toBe('not_found');
      expect(result.canConfirm).toBe(false);
    });

    it('returns canConfirm=false for viewer role', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue({
        id: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 80,
        status: TransactionStatus.review,
        transaction: { content: 'Test' },
        amount: 50000,
      });

      const result = await service.proposeConfirmClassification('tenant-1', 'txn-1', Role.VIEWER);

      expect(result.canConfirm).toBe(false);
      expect(result.reason).toContain('quyền');
    });

    it('returns canConfirm=true for admin on review classification', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue({
        id: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 80,
        status: TransactionStatus.review,
        transaction: { content: 'Test' },
        amount: 50000,
      });

      const result = await service.proposeConfirmClassification('tenant-1', 'txn-1', Role.ADMIN);

      expect(result.canConfirm).toBe(true);
    });

    it('returns canConfirm=false when status is not review', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue({
        id: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 80,
        status: TransactionStatus.classified,
        transaction: { content: 'Test' },
        amount: 50000,
      });

      const result = await service.proposeConfirmClassification('tenant-1', 'txn-1', Role.ADMIN);

      expect(result.canConfirm).toBe(false);
      expect(result.reason).toContain('xử lý');
    });
  });

  describe('proposeCorrectClassification', () => {
    it('returns not_found when classification does not exist', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue(null);

      const result = await service.proposeCorrectClassification(
        'tenant-1',
        'txn-missing',
        '642',
        '112',
        Role.ADMIN,
      );

      expect(result.status).toBe('not_found');
      expect(result.canCorrect).toBe(false);
    });

    it('returns canCorrect=false when account codes are invalid', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue({
        id: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 80,
        status: TransactionStatus.review,
        transaction: { content: 'Test' },
        amount: 50000,
      });
      prisma.chartOfAccount.findMany.mockResolvedValue([]);

      const result = await service.proposeCorrectClassification(
        'tenant-1',
        'txn-1',
        '999',
        '112',
        Role.ADMIN,
      );

      expect(result.canCorrect).toBe(false);
      expect(result.reason).toContain('999');
    });

    it('returns canCorrect=true when accounts are valid and status is review', async () => {
      prisma.transactionClassification.findFirst.mockResolvedValue({
        id: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 80,
        status: TransactionStatus.review,
        transaction: { content: 'Test' },
        amount: 50000,
      });
      prisma.chartOfAccount.findMany.mockResolvedValue([
        { accountCode: '642' },
        { accountCode: '112' },
      ]);

      const result = await service.proposeCorrectClassification(
        'tenant-1',
        'txn-1',
        '642',
        '112',
        Role.ADMIN,
      );

      expect(result.canCorrect).toBe(true);
    });
  });
});
