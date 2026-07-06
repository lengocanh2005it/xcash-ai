import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tavily } from '@tavily/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ReportService } from '../report/report.service';
import { getCasIntegrationFaq } from './copilot-cas-faq';

@Injectable()
export class CopilotToolService {
  private readonly logger = new Logger(CopilotToolService.name);

  constructor(
    private readonly reportService: ReportService,
    private readonly onboardingService: OnboardingService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async getMonthSummary(tenantId: string, year: number, month: number) {
    const cacheKey = `copilot:tool:summary:${tenantId}:${year}-${month}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as ReturnType<ReportService['getSummary']>;

    const data = await this.reportService.getSummary(tenantId, year, month);
    const ttl = this.configService.get<number>('COPILOT_CONTEXT_CACHE_TTL_SECONDS', 300);
    await this.redisService.client.set(cacheKey, JSON.stringify(data), 'EX', ttl);
    return data;
  }

  private async getBankingStatus(tenantId: string) {
    const cacheKey = `copilot:tool:banking:${tenantId}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as object;

    const status = await this.onboardingService.getStatus(tenantId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // GD từ Casso có grantId (non-null); GD import Excel có grantId = null
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

  async execute(tenantId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'get_month_summary':
        return this.getMonthSummary(tenantId, Number(args.year), Number(args.month));

      case 'get_month_comparison':
        return this.reportService.getComparison(tenantId, Number(args.year), Number(args.month));

      case 'get_top_accounts':
        return this.reportService.getTopAccounts(
          tenantId,
          Number(args.year),
          Number(args.month),
          Math.min(10, Number(args.limit ?? 5)),
        );

      case 'get_review_queue_count':
        return {
          count: await this.prisma.transactionClassification.count({
            where: { tenantId, status: 'review' },
          }),
        };

      case 'lookup_chart_account':
        return this.prisma.chartOfAccount.findFirst({
          where: { tenantId, accountCode: String(args.accountCode) },
          select: { accountCode: true, accountName: true, accountType: true, isActive: true },
        });

      case 'get_banking_status':
        return this.getBankingStatus(tenantId);

      case 'get_cas_integration_help':
        return getCasIntegrationFaq(String(args.topic));

      case 'search_transactions': {
        const keyword = String(args.keyword ?? '');
        // source: 'cas' = GD từ Casso (grantId not null), 'import' = Excel (grantId null)
        const sourceArg = args.source ? String(args.source) : undefined;
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

      case 'search_casso_public':
        return this.searchCassoPublic(String(args.query ?? ''));

      default:
        throw new BadRequestException(`Unknown copilot tool: ${name}`);
    }
  }

  private async searchCassoPublic(query: string) {
    if (!query.trim()) return { results: [], disclaimer: '' };

    // Đảm bảo query luôn liên quan đến Casso
    const CASSO_KEYWORDS = ['casso', 'cas link', 'bankhub', 'cas balance'];
    const normalizedQuery = query.toLowerCase();
    const hasCassoKeyword = CASSO_KEYWORDS.some((kw) => normalizedQuery.includes(kw));
    const safeQuery = hasCassoKeyword ? query : `casso ${query}`;

    const cacheKey = `copilot:tool:casso_search:${Buffer.from(safeQuery).toString('base64').slice(0, 64)}`;
    const cached = await this.redisService.client.get(cacheKey);
    if (cached) return JSON.parse(cached) as object;

    const apiKey = this.configService.get<string>('TAVILY_API_KEY', '');
    if (!apiKey) {
      this.logger.warn('TAVILY_API_KEY chưa cấu hình — search_casso_public bị bỏ qua');
      return { results: [], disclaimer: 'Tính năng tìm kiếm chưa được cấu hình.' };
    }

    const client = tavily({ apiKey });
    const response = await client.search(`${safeQuery} site:casso.vn`, {
      maxResults: 3,
      searchDepth: 'basic',
      includeAnswer: true,
    });

    const payload = {
      answer: response.answer ?? null,
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content?.slice(0, 300) ?? '',
      })),
      disclaimer:
        'Thông tin từ website công khai của Casso. Để biết chi tiết tích hợp trong X-Cash AI, vào Cài đặt → Ngân hàng.',
    };

    await this.redisService.client.set(cacheKey, JSON.stringify(payload), 'EX', 86400);
    return payload;
  }
}
