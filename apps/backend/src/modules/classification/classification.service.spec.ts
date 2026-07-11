import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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
