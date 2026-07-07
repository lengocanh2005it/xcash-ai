import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUsageLogService } from './ai-usage-log.service';

describe('AiUsageLogService', () => {
  let service: AiUsageLogService;

  const prisma = {
    aiUsageLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiUsageLogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AiUsageLogService);
  });

  describe('record()', () => {
    it('persists a classify call with correct fields', async () => {
      prisma.aiUsageLog.create.mockResolvedValue({});

      service.record({
        tenantId: 'tenant-1',
        callType: 'classify',
        model: 'gpt-4o-mini',
        tokensIn: 300,
        tokensOut: 50,
        transactionId: 'txn-123',
      });

      // fire-and-forget: flush microtask queue
      await Promise.resolve();

      expect(prisma.aiUsageLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          callType: 'classify',
          model: 'gpt-4o-mini',
          tokensIn: 300,
          tokensOut: 50,
          transactionId: 'txn-123',
          conversationId: undefined,
        },
      });
    });

    it('sets tokensOut=0 for embedding calls', async () => {
      prisma.aiUsageLog.create.mockResolvedValue({});

      service.record({
        tenantId: 'tenant-1',
        callType: 'embedding',
        model: 'text-embedding-3-small',
        tokensIn: 120,
        tokensOut: 0,
      });

      await Promise.resolve();

      expect(prisma.aiUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ callType: 'embedding', tokensOut: 0 }),
        }),
      );
    });

    it('persists a copilot call with conversationId', async () => {
      prisma.aiUsageLog.create.mockResolvedValue({});

      service.record({
        tenantId: 'tenant-2',
        callType: 'copilot',
        model: 'gpt-4o-mini',
        tokensIn: 800,
        tokensOut: 200,
        conversationId: 'conv-456',
      });

      await Promise.resolve();

      expect(prisma.aiUsageLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            callType: 'copilot',
            conversationId: 'conv-456',
            transactionId: undefined,
          }),
        }),
      );
    });

    it('does not throw when Prisma fails (fire-and-forget)', async () => {
      prisma.aiUsageLog.create.mockRejectedValue(new Error('DB error'));

      expect(() =>
        service.record({
          tenantId: 'tenant-1',
          callType: 'classify',
          model: 'gpt-4o-mini',
          tokensIn: 100,
          tokensOut: 20,
        }),
      ).not.toThrow();

      // allow the rejected promise to settle
      await Promise.resolve();
      await Promise.resolve();
    });
  });
});
