import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ChartOfAccountsService } from './chart-of-accounts.service';

describe('ChartOfAccountsService copilot methods', () => {
  let service: ChartOfAccountsService;

  const prisma = {
    chartOfAccount: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChartOfAccountsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ChartOfAccountsService);
  });

  describe('findByCode', () => {
    it('returns account when found', async () => {
      prisma.chartOfAccount.findFirst.mockResolvedValue({
        accountCode: '1111',
        accountName: 'Tiền mặt',
        accountType: 'asset',
        isActive: true,
      });

      const result = await service.findByCode('tenant-1', '1111');

      expect(result).toEqual({
        accountCode: '1111',
        accountName: 'Tiền mặt',
        accountType: 'asset',
        isActive: true,
      });
    });

    it('returns null when not found', async () => {
      prisma.chartOfAccount.findFirst.mockResolvedValue(null);

      const result = await service.findByCode('tenant-1', '9999');

      expect(result).toBeNull();
    });
  });

  describe('listFiltered', () => {
    it('returns all active accounts when no type filter', async () => {
      prisma.chartOfAccount.findMany.mockResolvedValue([
        { accountCode: '1111', accountName: 'Tiền mặt', accountType: 'asset' },
        { accountCode: '511', accountName: 'Doanh thu', accountType: 'revenue' },
      ]);

      const result = await service.listFiltered('tenant-1');

      expect(result).toHaveLength(2);
      expect(prisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', isActive: true },
          take: 50,
        }),
      );
    });

    it('filters by accountType when valid', async () => {
      prisma.chartOfAccount.findMany.mockResolvedValue([
        { accountCode: '511', accountName: 'Doanh thu', accountType: 'revenue' },
      ]);

      const result = await service.listFiltered('tenant-1', 'revenue');

      expect(result).toHaveLength(1);
      expect(prisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ accountType: 'revenue' }),
        }),
      );
    });

    it('ignores invalid accountType', async () => {
      prisma.chartOfAccount.findMany.mockResolvedValue([]);

      await service.listFiltered('tenant-1', 'invalid_type');

      expect(prisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', isActive: true },
        }),
      );
    });

    it('clamps limit between 1 and 100', async () => {
      prisma.chartOfAccount.findMany.mockResolvedValue([]);

      await service.listFiltered('tenant-1', undefined, 999);

      expect(prisma.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });
});
