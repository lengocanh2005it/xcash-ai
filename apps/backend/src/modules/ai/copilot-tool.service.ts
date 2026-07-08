import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';
import { Role } from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ReportService } from '../report/report.service';
import { COPILOT_TOOLS, type CopilotToolEntry } from './copilot-tool.registry';
import { type KnowledgeSearchResult, searchKnowledgeByKeyword } from './knowledge';
import { OpenAiService } from './openai.service';

const CONFIRMABLE_ROLES = new Set<Role>([Role.ADMIN, Role.ACCOUNTANT]);

type MonthSummary = Awaited<ReturnType<ReportService['getSummary']>>;

@Injectable()
export class CopilotToolService {
  private readonly logger = new Logger(CopilotToolService.name);
  private readonly tavilyClient: ReturnType<typeof tavily> | null;
  private readonly registry: Map<string, CopilotToolEntry>;

  constructor(
    private readonly reportService: ReportService,
    private readonly onboardingService: OnboardingService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly openAiService: OpenAiService,
  ) {
    const apiKey = configService.get<string>('TAVILY_API_KEY', '');
    this.tavilyClient = apiKey ? tavily({ apiKey }) : null;
    this.registry = new Map(COPILOT_TOOLS.map((t) => [t.name, t]));
  }

  // ---------------------------------------------------------------------------
  // Tool implementations (public — called by registry execute closures)
  // ---------------------------------------------------------------------------

  async getMonthSummary(tenantId: string, year: number, month: number) {
    const cacheKey = `copilot:tool:summary:${tenantId}:${year}-${month}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as MonthSummary;

    const data = await this.reportService.getSummary(tenantId, year, month);
    const ttl = this.configService.get<number>('COPILOT_CONTEXT_CACHE_TTL_SECONDS', 300);
    await this.redisService.client.set(cacheKey, JSON.stringify(data), 'EX', ttl);
    return data;
  }

  async getMonthComparison(tenantId: string, year: number, month: number) {
    return this.reportService.getComparison(tenantId, year, month);
  }

  async getTopAccounts(tenantId: string, year: number, month: number, limit: number) {
    return this.reportService.getTopAccounts(tenantId, year, month, limit);
  }

  async getReviewQueueCount(tenantId: string) {
    return {
      count: await this.prisma.transactionClassification.count({
        where: { tenantId, status: 'review' },
      }),
    };
  }

  async lookupChartAccount(tenantId: string, accountCode: string) {
    return this.prisma.chartOfAccount.findFirst({
      where: { tenantId, accountCode },
      select: { accountCode: true, accountName: true, accountType: true, isActive: true },
    });
  }

  async getBankingStatus(tenantId: string) {
    const cacheKey = `copilot:tool:banking:${tenantId}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as object;

    const status = await this.onboardingService.getStatus(tenantId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [lastCas, countLast7Days] = await Promise.all([
      this.prisma.transaction.findFirst({
        where: { tenantId, grantId: { not: null } },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      }),
      this.prisma.transaction.count({
        where: { tenantId, grantId: { not: null }, transactionDate: { gte: sevenDaysAgo } },
      }),
    ]);

    const payload = {
      bankingLinked: status.bankingLinked,
      grants: status.grants.map((g) => ({
        bankName: g.bankName,
        accountNumber: g.accountNumber,
        linkedAt: g.linkedAt,
        status: g.status,
      })),
      recentCasActivity: {
        lastTransactionAt: lastCas?.transactionDate?.toISOString() ?? null,
        countLast7Days,
      },
      uiHints: {
        settingsBankingPath: '/settings',
        onboardingPath: '/onboarding',
      },
    };

    await this.redisService.client.set(cacheKey, JSON.stringify(payload), 'EX', 60);
    return payload;
  }

  async searchTransactions(tenantId: string, args: Record<string, unknown>) {
    const keyword = String(args.keyword ?? '');
    const sourceArg = String(args.source ?? 'all');
    const grantFilter =
      sourceArg === 'cas'
        ? { grantId: { not: null } }
        : sourceArg === 'import'
          ? { grantId: null }
          : {};
    const limit = Math.min(20, Math.max(1, Number(args.limit ?? 10)));
    const items = await this.prisma.transaction.findMany({
      where: {
        tenantId,
        ...grantFilter,
        ...(keyword
          ? {
              OR: [
                { content: { contains: keyword, mode: 'insensitive' } },
                { senderAccount: { contains: keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        transactionId: true,
        content: true,
        amount: true,
        transactionDate: true,
        grantId: true,
        classification: {
          select: { debitAccount: true, creditAccount: true, status: true },
        },
      },
      orderBy: { transactionDate: 'desc' },
      take: limit,
    });
    return {
      items: items.map((t) => ({ ...t, source: t.grantId ? 'cas' : 'import' })),
      total: items.length,
    };
  }

  async proposeConfirmTransactionClassification(
    tenantId: string,
    transactionId: string,
    role: Role,
  ) {
    const classification = await this.prisma.transactionClassification.findFirst({
      where: { tenantId, transactionId },
      include: { transaction: { select: { content: true } } },
    });

    if (!classification) {
      return {
        transactionId,
        classificationId: '',
        debitAccount: '',
        creditAccount: '',
        confidence: 0,
        status: 'not_found',
        content: '',
        amount: 0,
        canConfirm: false,
        reason: 'Không tìm thấy định khoản cho giao dịch này',
      };
    }

    const base = {
      transactionId,
      classificationId: classification.id,
      debitAccount: classification.debitAccount,
      creditAccount: classification.creditAccount,
      confidence: classification.confidenceScore,
      status: classification.status,
      content: classification.transaction.content,
      amount: Number(classification.amount),
    };

    if (!CONFIRMABLE_ROLES.has(role)) {
      return {
        ...base,
        canConfirm: false,
        reason: 'Bạn không có quyền xác nhận giao dịch này (chỉ admin/kế toán)',
      };
    }

    if (classification.status !== 'review') {
      return {
        ...base,
        canConfirm: false,
        reason: 'Giao dịch này đã được xử lý, không còn ở trạng thái chờ duyệt',
      };
    }

    return { ...base, canConfirm: true };
  }

  async proposeCorrectTransactionClassification(
    tenantId: string,
    transactionId: string,
    debitAccount: string,
    creditAccount: string,
    role: Role,
  ) {
    const classification = await this.prisma.transactionClassification.findFirst({
      where: { tenantId, transactionId },
      include: { transaction: { select: { content: true } } },
    });

    if (!classification) {
      return {
        transactionId,
        classificationId: '',
        debitAccount: '',
        creditAccount: '',
        proposedDebitAccount: debitAccount,
        proposedCreditAccount: creditAccount,
        confidence: 0,
        status: 'not_found',
        content: '',
        amount: 0,
        canCorrect: false,
        reason: 'Không tìm thấy định khoản cho giao dịch này',
      };
    }

    const base = {
      transactionId,
      classificationId: classification.id,
      debitAccount: classification.debitAccount,
      creditAccount: classification.creditAccount,
      proposedDebitAccount: debitAccount,
      proposedCreditAccount: creditAccount,
      confidence: classification.confidenceScore,
      status: classification.status,
      content: classification.transaction.content,
      amount: Number(classification.amount),
    };

    if (!CONFIRMABLE_ROLES.has(role)) {
      return {
        ...base,
        canCorrect: false,
        reason: 'Bạn không có quyền sửa định khoản giao dịch này (chỉ admin/kế toán)',
      };
    }

    if (classification.status !== 'review') {
      return {
        ...base,
        canCorrect: false,
        reason: 'Giao dịch này đã được xử lý, không còn ở trạng thái chờ duyệt',
      };
    }

    const validAccounts = await this.prisma.chartOfAccount.findMany({
      where: { tenantId, accountCode: { in: [debitAccount, creditAccount] }, isActive: true },
      select: { accountCode: true },
    });
    const validCodes = new Set(validAccounts.map((a) => a.accountCode));
    const debitValid = validCodes.has(debitAccount);
    const creditValid = validCodes.has(creditAccount);

    if (!debitValid || !creditValid) {
      const invalidCode = !debitValid ? debitAccount : creditAccount;
      return {
        ...base,
        canCorrect: false,
        reason: `Mã tài khoản ${invalidCode} không tồn tại hoặc không còn hoạt động trong hệ thống TT133`,
      };
    }

    return { ...base, canCorrect: true };
  }

  async searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
    if (!query.trim()) return { sections: [], query, totalFound: 0 };

    if (!this.openAiService.isConfigured()) return searchKnowledgeByKeyword(query);

    try {
      const vector = await this.openAiService.createEmbedding(query);
      if (!vector) return searchKnowledgeByKeyword(query);

      const vectorStr = `[${vector.join(',')}]`;
      const rows = await this.prisma.$queryRaw<
        Array<{ section_id: string; title: string; content: string; distance: number }>
      >`
        SELECT section_id, title, content, embedding <=> ${vectorStr}::vector AS distance
        FROM knowledge_embeddings
        ORDER BY distance ASC
        LIMIT 2
      `;

      if (rows.length === 0) return searchKnowledgeByKeyword(query);

      return {
        sections: rows.map((r) => ({ id: r.section_id, title: r.title, content: r.content })),
        query,
        totalFound: rows.length,
      };
    } catch (err) {
      this.logger.warn(
        `pgvector knowledge search thất bại, dùng keyword fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
      return searchKnowledgeByKeyword(query);
    }
  }

  async searchCassoPublic(query: string) {
    if (!query.trim()) return { results: [], disclaimer: '' };

    const CASSO_KEYWORDS = ['casso', 'cas link', 'bankhub', 'cas balance'];
    const normalizedQuery = query.toLowerCase();
    const hasCassoKeyword = CASSO_KEYWORDS.some((kw) => normalizedQuery.includes(kw));
    const safeQuery = hasCassoKeyword ? query : `casso ${query}`;

    const maxResults = this.configService.get<number>('TAVILY_MAX_RESULTS', 5);
    const searchDepth = this.configService.get<string>('TAVILY_SEARCH_DEPTH', 'basic') as
      | 'basic'
      | 'advanced';
    const cacheKey = `copilot:tool:casso_search:${searchDepth}:${Buffer.from(safeQuery).toString('base64').slice(0, 60)}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as object;

    if (!this.tavilyClient) {
      this.logger.warn('TAVILY_API_KEY chưa cấu hình — search_casso_public bị bỏ qua');
      return { results: [], disclaimer: 'Tính năng tìm kiếm chưa được cấu hình.' };
    }

    const timeoutMs = this.configService.get<number>('TAVILY_TIMEOUT_MS', 3000);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tavily search timeout')), timeoutMs),
    );
    let response: Awaited<ReturnType<typeof this.tavilyClient.search>>;
    try {
      response = await Promise.race([
        this.tavilyClient.search(`${safeQuery} site:casso.vn`, {
          maxResults,
          searchDepth,
          includeAnswer: true,
          includeRawContent: 'text',
        }),
        timeout,
      ]);
    } catch (err) {
      this.logger.error(
        `search_casso_public thất bại (depth=${searchDepth}, timeout=${timeoutMs}ms): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { results: [], disclaimer: 'Không thể tìm kiếm lúc này. Vui lòng thử lại sau.' };
    }

    const payload = {
      answer: response.answer ?? null,
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: (r.rawContent ?? r.content)?.slice(0, 800) ?? '',
      })),
      disclaimer:
        'Thông tin từ website công khai của Casso. Để biết chi tiết tích hợp trong X-Cash AI, vào Cài đặt → Ngân hàng.',
    };

    await this.redisService.client.set(cacheKey, JSON.stringify(payload), 'EX', 86400);
    return payload;
  }

  // ---------------------------------------------------------------------------
  // Dispatcher — registry lookup replaces switch
  // ---------------------------------------------------------------------------

  async execute(
    tenantId: string,
    name: string,
    args: Record<string, unknown>,
    role?: Role,
  ): Promise<unknown> {
    const entry = this.registry.get(name);
    if (!entry) throw new BadRequestException(`Unknown copilot tool: ${name}`);
    return entry.execute(this, tenantId, args, role);
  }

  // ---------------------------------------------------------------------------
  // Registry accessors (used by factory + activity helper)
  // ---------------------------------------------------------------------------

  getRegistry(): Map<string, CopilotToolEntry> {
    return this.registry;
  }
}
