import { Injectable, Logger } from '@nestjs/common';
import { type AccountType, type Prisma, TransactionStatus } from '@prisma/client';
import { Role } from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { OnboardingService } from '../onboarding/onboarding.service';

const CONFIRMABLE_ROLES = new Set<Role>([Role.ADMIN, Role.ACCOUNTANT]);

@Injectable()
export class CopilotTransactionQueryService {
  private readonly logger = new Logger(CopilotTransactionQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly onboardingService: OnboardingService,
    private readonly redisService: RedisService,
  ) {}

  // ── Review queue ───────────────────────────────────────────────────────────

  async getReviewQueueCount(tenantId: string, year?: number, month?: number) {
    return {
      count: await this.prisma.transactionClassification.count({
        where: this.reviewQueueWhere(tenantId, year, month),
      }),
      ...(year != null && month != null ? { period: { year, month } } : { scope: 'all' as const }),
    };
  }

  async listReviewQueue(tenantId: string, limit = 10, year?: number, month?: number) {
    const take = Math.min(20, Math.max(1, Number(limit) || 10));
    const where = this.reviewQueueWhere(tenantId, year, month);

    const [classifications, total] = await Promise.all([
      this.prisma.transactionClassification.findMany({
        where,
        include: {
          transaction: {
            select: {
              id: true,
              content: true,
              amount: true,
              transactionDate: true,
              grantId: true,
            },
          },
        },
        orderBy: [{ transaction: { transactionDate: 'desc' } }, { createdAt: 'desc' }],
        take,
      }),
      this.prisma.transactionClassification.count({ where }),
    ]);

    return {
      total,
      ...(year != null && month != null ? { period: { year, month } } : { scope: 'all' as const }),
      items: classifications.map((c) => ({
        id: c.transaction.id,
        content: c.transaction.content,
        amount: Number(c.transaction.amount),
        transactionDate: c.transaction.transactionDate?.toISOString() ?? null,
        source: c.transaction.grantId ? 'cas' : 'import',
        debitAccount: c.debitAccount,
        creditAccount: c.creditAccount,
        confidence: c.confidenceScore,
        status: c.status,
      })),
    };
  }

  private reviewQueueWhere(tenantId: string, year?: number, month?: number) {
    const where: {
      tenantId: string;
      status: 'review';
      transaction?: { transactionDate: { gte: Date; lt: Date } };
    } = { tenantId, status: 'review' };

    if (
      year != null &&
      month != null &&
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      month >= 1 &&
      month <= 12
    ) {
      where.transaction = {
        transactionDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
      };
    }

    return where;
  }

  // ── Chart of accounts ──────────────────────────────────────────────────────

  async lookupChartAccount(tenantId: string, accountCode: string) {
    return this.prisma.chartOfAccount.findFirst({
      where: { tenantId, accountCode },
      select: { accountCode: true, accountName: true, accountType: true, isActive: true },
    });
  }

  async listChartAccounts(tenantId: string, accountType?: string, limit = 50) {
    const validAccountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    const where: Prisma.ChartOfAccountWhereInput = {
      tenantId,
      isActive: true,
      ...(accountType && validAccountTypes.includes(accountType)
        ? { accountType: accountType as AccountType }
        : {}),
    };

    return this.prisma.chartOfAccount.findMany({
      where,
      select: { accountCode: true, accountName: true, accountType: true },
      orderBy: { accountCode: 'asc' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }

  // ── Banking status ─────────────────────────────────────────────────────────

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

  // ── Transaction search ─────────────────────────────────────────────────────

  async searchTransactions(tenantId: string, args: Record<string, unknown>) {
    const keyword = String(args.keyword ?? '').trim();
    const sourceArg = String(args.source ?? 'all');
    const classificationStatus = String(args.classificationStatus ?? 'all');
    const accountCode = String(args.accountCode ?? '').trim();
    const grantFilter =
      sourceArg === 'cas'
        ? { grantId: { not: null } }
        : sourceArg === 'import'
          ? { grantId: null }
          : {};
    const limit = Math.min(20, Math.max(1, Number(args.limit ?? 10)));

    const classificationStatusArg =
      classificationStatus !== 'all' &&
      (classificationStatus === 'review' ||
        classificationStatus === 'classified' ||
        classificationStatus === 'pending')
        ? (classificationStatus as TransactionStatus)
        : undefined;

    const classificationFilter: Prisma.TransactionWhereInput =
      classificationStatusArg || accountCode
        ? {
            classification: {
              is: {
                ...(classificationStatusArg ? { status: classificationStatusArg } : {}),
                ...(accountCode
                  ? { OR: [{ debitAccount: accountCode }, { creditAccount: accountCode }] }
                  : {}),
              },
            },
          }
        : {};

    const where: Prisma.TransactionWhereInput = {
      tenantId,
      ...grantFilter,
      ...classificationFilter,
      ...(keyword
        ? {
            OR: [
              { content: { contains: keyword, mode: 'insensitive' as const } },
              { senderAccount: { contains: keyword, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
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
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      total,
      items: items.map((t) => ({
        id: t.id,
        bankTransactionId: t.transactionId,
        content: t.content,
        amount: Number(t.amount),
        transactionDate: t.transactionDate?.toISOString() ?? null,
        source: t.grantId ? 'cas' : 'import',
        debitAccount: t.classification?.debitAccount ?? null,
        creditAccount: t.classification?.creditAccount ?? null,
        classificationStatus: t.classification?.status ?? null,
      })),
    };
  }

  // ── Classification validation (action tools) ──────────────────────────────

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
}
