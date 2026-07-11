import { BadRequestException } from '@nestjs/common';
import { executeTool, getToolRegistry, type ToolDeps } from './copilot-tool.executor';

const deps: ToolDeps = {
  reportService: {
    getSummary: jest.fn().mockResolvedValue({ summary: { totalRevenue: 1000 } }),
  } as never,
  txQueryService: {
    getReviewQueueCount: jest.fn().mockResolvedValue({ count: 5 }),
    searchTransactions: jest.fn().mockResolvedValue({ total: 0, items: [] }),
  } as never,
  knowledgeService: {
    searchKnowledge: jest.fn().mockResolvedValue({ sections: [], totalFound: 0 }),
  } as never,
  billingService: {
    getCurrentPlan: jest.fn().mockResolvedValue({ plan: 'pro' }),
  } as never,
  exportService: {
    createExport: jest.fn().mockResolvedValue({
      exportId: 'export-1',
      format: 'excel',
      fileName: 'bao-cao-dinh-khoan-2026-07-01-2026-07-31.xlsx',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    }),
  } as never,
};

describe('executeTool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws BadRequestException for unknown tool', async () => {
    await expect(executeTool(deps, 'unknown_tool', 'tenant-1', {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('dispatches get_month_summary to reportService.getSummary', async () => {
    const result = await executeTool(deps, 'get_month_summary', 'tenant-1', {
      year: 2026,
      month: 7,
    });
    expect(deps.reportService.getSummary).toHaveBeenCalledWith('tenant-1', 2026, 7);
    expect(result).toEqual({ summary: { totalRevenue: 1000 } });
  });

  it('dispatches search_knowledge_base to knowledgeService.searchKnowledge', async () => {
    const result = await executeTool(deps, 'search_knowledge_base', 'tenant-1', {
      query: 'Casso là gì',
    });
    expect(deps.knowledgeService.searchKnowledge).toHaveBeenCalledWith('Casso là gì');
    expect(result).toEqual({ sections: [], totalFound: 0 });
  });
});

describe('getToolRegistry', () => {
  it('returns a Map with all registered tools', () => {
    const registry = getToolRegistry();
    expect(registry).toBeInstanceOf(Map);
    expect(registry.size).toBeGreaterThan(0);
    expect(registry.has('get_month_summary')).toBe(true);
    expect(registry.has('search_knowledge_base')).toBe(true);
    expect(registry.has('search_transactions')).toBe(true);
  });
});

describe('export_report tool', () => {
  it('dispatches export_report with year+month to exportService.createExport', async () => {
    const result = await executeTool(deps, 'export_report', 'tenant-1', {
      format: 'excel',
      year: 2026,
      month: 7,
    });
    expect(deps.exportService.createExport).toHaveBeenCalledWith(
      'tenant-1',
      'excel',
      '2026-07-01',
      '2026-07-31',
    );
    expect(result).toEqual({
      exportId: 'export-1',
      format: 'excel',
      fileName: 'bao-cao-dinh-khoan-2026-07-01-2026-07-31.xlsx',
      fromDate: '2026-07-01',
      toDate: '2026-07-31',
    });
  });

  it('dispatches export_report with startDate+endDate to exportService.createExport', async () => {
    await executeTool(deps, 'export_report', 'tenant-1', {
      format: 'pdf',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });
    expect(deps.exportService.createExport).toHaveBeenCalledWith(
      'tenant-1',
      'pdf',
      '2026-01-01',
      '2026-06-30',
    );
  });

  it('throws BadRequestException when neither pair of params is given', async () => {
    await expect(
      executeTool(deps, 'export_report', 'tenant-1', { format: 'excel' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when both pairs of params are given', async () => {
    await expect(
      executeTool(deps, 'export_report', 'tenant-1', {
        format: 'excel',
        year: 2026,
        month: 7,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
