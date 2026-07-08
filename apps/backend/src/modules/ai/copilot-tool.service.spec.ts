import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ReportService } from '../report/report.service';
import { CopilotToolService } from './copilot-tool.service';
import { OpenAiService } from './openai.service';

describe('CopilotToolService — propose_confirm_transaction_classification', () => {
  let service: CopilotToolService;

  const prisma = {
    transactionClassification: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotToolService,
        { provide: ReportService, useValue: {} },
        { provide: OnboardingService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { client: { get: jest.fn(), set: jest.fn() } } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: OpenAiService, useValue: {} },
      ],
    }).compile();

    service = module.get(CopilotToolService);
  });

  it('trả canConfirm=true kèm đủ field khi status=review và role có quyền', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-1',
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 92,
      status: 'review',
      amount: 150000,
      transaction: { content: 'Thanh toán điện nước' },
    });

    const result = (await service.proposeConfirmTransactionClassification(
      'tenant-1',
      'txn-1',
      Role.ACCOUNTANT,
    )) as Record<string, unknown>;

    expect(result).toEqual(
      expect.objectContaining({
        transactionId: 'txn-1',
        classificationId: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        confidence: 92,
        status: 'review',
        content: 'Thanh toán điện nước',
        amount: 150000,
        canConfirm: true,
      }),
    );
  });

  it('trả canConfirm=false kèm lý do khi status khác review', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-2',
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 92,
      status: 'classified',
      amount: 150000,
      transaction: { content: 'Thanh toán điện nước' },
    });

    const result = (await service.proposeConfirmTransactionClassification(
      'tenant-1',
      'txn-2',
      Role.ACCOUNTANT,
    )) as Record<string, unknown>;

    expect(result.canConfirm).toBe(false);
    expect(result.status).toBe('classified');
    expect(typeof result.reason).toBe('string');
  });

  it('trả canConfirm=false kèm lý do khi role là viewer, dù status=review', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue({
      id: 'class-3',
      debitAccount: '642',
      creditAccount: '112',
      confidenceScore: 92,
      status: 'review',
      amount: 150000,
      transaction: { content: 'Thanh toán điện nước' },
    });

    const result = (await service.proposeConfirmTransactionClassification(
      'tenant-1',
      'txn-3',
      Role.VIEWER,
    )) as Record<string, unknown>;

    expect(result.canConfirm).toBe(false);
    expect(result.status).toBe('review');
    expect(typeof result.reason).toBe('string');
  });
});
