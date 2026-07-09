import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ReportService } from '../report/report.service';
import { CopilotBillingService } from './copilot-billing.service';
import { CopilotKnowledgeService } from './copilot-knowledge.service';
import { CopilotToolService } from './copilot-tool.service';
import { CopilotTransactionQueryService } from './copilot-tx-query.service';

describe('CopilotTransactionQueryService — propose_confirm_transaction_classification', () => {
  let service: CopilotTransactionQueryService;

  const prisma = {
    transactionClassification: {
      findFirst: jest.fn(),
    },
    chartOfAccount: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotTransactionQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnboardingService, useValue: {} },
        { provide: RedisService, useValue: { client: { get: jest.fn(), set: jest.fn() } } },
      ],
    }).compile();

    service = module.get(CopilotTransactionQueryService);
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

describe('CopilotTransactionQueryService — propose_correct_transaction_classification', () => {
  let service: CopilotTransactionQueryService;

  const prisma = {
    transactionClassification: {
      findFirst: jest.fn(),
    },
    chartOfAccount: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotTransactionQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnboardingService, useValue: {} },
        { provide: RedisService, useValue: { client: { get: jest.fn(), set: jest.fn() } } },
      ],
    }).compile();

    service = module.get(CopilotTransactionQueryService);
  });

  const mockClassification = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'class-1',
    debitAccount: '642',
    creditAccount: '112',
    confidenceScore: 92,
    status: 'review',
    amount: 150000,
    transaction: { content: 'Thanh toán điện nước' },
    ...overrides,
  });

  const mockBothAccountsValid = [{ accountCode: '641' }, { accountCode: '111' }];

  it('trả canCorrect=true kèm đủ field cũ + mới khi role/status/mã TK đều hợp lệ', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue(mockClassification());
    prisma.chartOfAccount.findMany.mockResolvedValue(mockBothAccountsValid);

    const result = (await service.proposeCorrectTransactionClassification(
      'tenant-1',
      'txn-1',
      '641',
      '111',
      Role.ACCOUNTANT,
    )) as Record<string, unknown>;

    expect(result).toEqual(
      expect.objectContaining({
        transactionId: 'txn-1',
        classificationId: 'class-1',
        debitAccount: '642',
        creditAccount: '112',
        proposedDebitAccount: '641',
        proposedCreditAccount: '111',
        canCorrect: true,
      }),
    );
  });

  it('trả canCorrect=false kèm lý do khi role là viewer', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue(mockClassification());
    prisma.chartOfAccount.findMany.mockResolvedValue(mockBothAccountsValid);

    const result = (await service.proposeCorrectTransactionClassification(
      'tenant-1',
      'txn-2',
      '641',
      '111',
      Role.VIEWER,
    )) as Record<string, unknown>;

    expect(result.canCorrect).toBe(false);
    expect(typeof result.reason).toBe('string');
  });

  it('trả canCorrect=false kèm lý do khi status khác review', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue(
      mockClassification({ status: 'classified' }),
    );
    prisma.chartOfAccount.findMany.mockResolvedValue(mockBothAccountsValid);

    const result = (await service.proposeCorrectTransactionClassification(
      'tenant-1',
      'txn-3',
      '641',
      '111',
      Role.ACCOUNTANT,
    )) as Record<string, unknown>;

    expect(result.canCorrect).toBe(false);
    expect(result.status).toBe('classified');
    expect(typeof result.reason).toBe('string');
  });

  it('trả canCorrect=false kèm lý do khi mã tài khoản mới không hợp lệ', async () => {
    prisma.transactionClassification.findFirst.mockResolvedValue(mockClassification());
    prisma.chartOfAccount.findMany.mockResolvedValue([]);

    const result = (await service.proposeCorrectTransactionClassification(
      'tenant-1',
      'txn-4',
      '999',
      '111',
      Role.ACCOUNTANT,
    )) as Record<string, unknown>;

    expect(result.canCorrect).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});

describe('CopilotTransactionQueryService — listReviewQueue', () => {
  let service: CopilotTransactionQueryService;

  const prisma = {
    transactionClassification: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotTransactionQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnboardingService, useValue: {} },
        { provide: RedisService, useValue: { client: { get: jest.fn(), set: jest.fn() } } },
      ],
    }).compile();

    service = module.get(CopilotTransactionQueryService);
  });

  it('trả danh sách GD status=review với mã id nội bộ', async () => {
    prisma.transactionClassification.findMany.mockResolvedValue([
      {
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 72,
        status: 'review',
        transaction: {
          id: 'uuid-1',
          content: 'Thanh toán điện',
          amount: -500000,
          transactionDate: new Date('2026-07-01'),
          grantId: 'grant-1',
        },
      },
    ]);
    prisma.transactionClassification.count.mockResolvedValue(1);

    const result = await service.listReviewQueue('tenant-1', 10);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'uuid-1',
      debitAccount: '642',
      creditAccount: '112',
      status: 'review',
      source: 'cas',
    });
  });
});

describe('CopilotTransactionQueryService — searchTransactions', () => {
  let service: CopilotTransactionQueryService;

  const prisma = {
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotTransactionQueryService,
        { provide: PrismaService, useValue: prisma },
        { provide: OnboardingService, useValue: {} },
        { provide: RedisService, useValue: { client: { get: jest.fn(), set: jest.fn() } } },
      ],
    }).compile();

    service = module.get(CopilotTransactionQueryService);
  });

  it('trả id nội bộ và lọc classificationStatus=review', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'uuid-search-1',
        transactionId: 'BANK-REF-1',
        content: 'Thanh toán',
        amount: -100000,
        transactionDate: new Date('2026-07-01'),
        grantId: 'g1',
        classification: { debitAccount: '642', creditAccount: '112', status: 'review' },
      },
    ]);
    prisma.transaction.count.mockResolvedValue(1);

    const result = await service.searchTransactions('tenant-1', {
      classificationStatus: 'review',
      limit: 5,
    });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          classification: { is: { status: 'review' } },
        }),
      }),
    );
    expect(result.items[0]).toMatchObject({
      id: 'uuid-search-1',
      bankTransactionId: 'BANK-REF-1',
      classificationStatus: 'review',
    });
    expect(result.total).toBe(1);
  });
});

describe('CopilotToolService — facade dispatch', () => {
  let service: CopilotToolService;

  const mockReportService = {
    getSummary: jest.fn().mockResolvedValue({ summary: { totalRevenue: 1000 } }),
    getComparison: jest.fn().mockResolvedValue({ current: {} }),
    getTopAccounts: jest.fn().mockResolvedValue([]),
  };

  const mockTxQueryService = {
    getReviewQueueCount: jest.fn().mockResolvedValue({ count: 5 }),
    listReviewQueue: jest.fn().mockResolvedValue({ total: 5, items: [] }),
    lookupChartAccount: jest.fn().mockResolvedValue(null),
    getBankingStatus: jest.fn().mockResolvedValue({ bankingLinked: true }),
    searchTransactions: jest.fn().mockResolvedValue({ total: 0, items: [] }),
    proposeConfirmTransactionClassification: jest.fn().mockResolvedValue({ canConfirm: true }),
    proposeCorrectTransactionClassification: jest.fn().mockResolvedValue({ canCorrect: true }),
  };

  const mockKnowledgeService = {
    searchKnowledge: jest.fn().mockResolvedValue({ sections: [], totalFound: 0 }),
    searchCassoPublic: jest.fn().mockResolvedValue({ results: [] }),
  };

  const mockBillingService = {
    getCurrentPlan: jest.fn().mockResolvedValue({ plan: 'pro' }),
    getPaymentHistory: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotToolService,
        { provide: ReportService, useValue: mockReportService },
        { provide: CopilotKnowledgeService, useValue: mockKnowledgeService },
        { provide: CopilotTransactionQueryService, useValue: mockTxQueryService },
        { provide: CopilotBillingService, useValue: mockBillingService },
      ],
    }).compile();

    service = module.get(CopilotToolService);
  });

  it('execute dispatches to correct registry entry', async () => {
    const result = await service.execute('tenant-1', 'get_month_summary', {
      year: 2026,
      month: 7,
    });
    expect(mockReportService.getSummary).toHaveBeenCalledWith('tenant-1', 2026, 7);
    expect(result).toEqual({ summary: { totalRevenue: 1000 } });
  });

  it('execute throws on unknown tool', async () => {
    await expect(service.execute('tenant-1', 'unknown_tool', {})).rejects.toThrow(
      'Unknown copilot tool: unknown_tool',
    );
  });

  it('getRegistry returns all registered tools', () => {
    const registry = service.getRegistry();
    expect(registry.size).toBeGreaterThan(0);
    expect(registry.has('get_month_summary')).toBe(true);
    expect(registry.has('search_knowledge_base')).toBe(true);
  });
});
