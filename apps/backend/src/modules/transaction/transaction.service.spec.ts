import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { AI_CLASSIFY_JOB } from '../ai/classification.constants';
import { TransactionService } from './transaction.service';

describe('TransactionService', () => {
  const prisma = {
    transaction: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const webhookQueue = {
    add: jest.fn(),
  };

  const service = new TransactionService(prisma as never, webhookQueue as unknown as Queue);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reclassify', () => {
    it('enqueues AI job for pending transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        status: TransactionStatus.pending,
      });

      const result = await service.reclassify('tenant-1', 'txn-1');

      expect(webhookQueue.add).toHaveBeenCalledWith(AI_CLASSIFY_JOB, { transactionDbId: 'txn-1' });
      expect(result).toEqual({ success: true, status: TransactionStatus.pending });
    });

    it('rejects non-pending transaction', async () => {
      prisma.transaction.findFirst.mockResolvedValue({
        id: 'txn-1',
        status: TransactionStatus.classified,
      });

      await expect(service.reclassify('tenant-1', 'txn-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws when transaction not found', async () => {
      prisma.transaction.findFirst.mockResolvedValue(null);

      await expect(service.reclassify('tenant-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('bulkReclassify', () => {
    it('enqueues only pending transactions and reports skipped', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { id: 'txn-1', status: TransactionStatus.pending },
        { id: 'txn-2', status: TransactionStatus.classified },
        { id: 'txn-3', status: TransactionStatus.pending },
      ]);

      const result = await service.bulkReclassify('tenant-1', [
        'txn-1',
        'txn-2',
        'txn-3',
        'missing',
      ]);

      expect(webhookQueue.add).toHaveBeenCalledTimes(2);
      expect(webhookQueue.add).toHaveBeenCalledWith(AI_CLASSIFY_JOB, { transactionDbId: 'txn-1' });
      expect(webhookQueue.add).toHaveBeenCalledWith(AI_CLASSIFY_JOB, { transactionDbId: 'txn-3' });
      expect(result).toEqual({ queued: 2, skipped: 2 });
    });

    it('throws when no transaction is eligible', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { id: 'txn-1', status: TransactionStatus.review },
      ]);

      await expect(service.bulkReclassify('tenant-1', ['txn-1'])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(webhookQueue.add).not.toHaveBeenCalled();
    });
  });
});
