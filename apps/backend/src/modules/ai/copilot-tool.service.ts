import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { ReportService } from '../report/report.service';
import { getCasIntegrationFaq } from './copilot-cas-faq';

@Injectable()
export class CopilotToolService {
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
    const [lastCas, countLast7Days] = await Promise.all([
      this.prisma.transaction.findFirst({
        where: { tenantId, source: 'cas' },
        orderBy: { transactionDate: 'desc' },
        select: { transactionDate: true },
      }),
      this.prisma.transaction.count({
        where: { tenantId, source: 'cas', transactionDate: { gte: sevenDaysAgo } },
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
        const source = args.source
          ? (String(args.source) as import('@prisma/client').TransactionSource)
          : undefined;
        const limit = Math.min(20, Math.max(1, Number(args.limit ?? 10)));
        const items = await this.prisma.transaction.findMany({
          where: {
            tenantId,
            ...(keyword
              ? {
                  OR: [
                    { content: { contains: keyword, mode: 'insensitive' } },
                    { senderAccount: { contains: keyword, mode: 'insensitive' } },
                  ],
                }
              : {}),
            ...(source ? { source } : {}),
          },
          select: {
            transactionId: true,
            content: true,
            amount: true,
            transactionDate: true,
            source: true,
            classification: {
              select: { debitAccount: true, creditAccount: true, status: true },
            },
          },
          orderBy: { transactionDate: 'desc' },
          take: limit,
        });
        return { items, total: items.length };
      }

      default:
        throw new BadRequestException(`Unknown copilot tool: ${name}`);
    }
  }
}
