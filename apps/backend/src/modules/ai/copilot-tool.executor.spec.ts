import { BadRequestException } from '@nestjs/common';
import { executeTool, getToolRegistry, type ToolDeps } from './copilot-tool.executor';

describe('executeTool', () => {
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
  };

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
