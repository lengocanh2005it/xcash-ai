import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClassificationType, Prisma, TransactionStatus } from '@prisma/client';
import { Role } from '@xcash/shared-types';
import { createAuditLog } from '../../common/util/audit-log.util';
import { paginateParams, paginateResult } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../ai/embedding.service';
import type { CorrectClassificationDto } from './dto/review.dto';

const CONFIRMABLE_ROLES = new Set<Role>([Role.ADMIN, Role.ACCOUNTANT]);

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async getClassification(tenantId: string, transactionId: string) {
    const classification = await this.prisma.transactionClassification.findFirst({
      where: { tenantId, transactionId },
      include: {
        transaction: {
          select: { content: true, amount: true, transactionDate: true, status: true },
        },
      },
    });
    if (!classification) throw new NotFoundException('Chưa có định khoản cho giao dịch này');
    return classification;
  }

  async getReviewCount(tenantId: string) {
    return this.prisma.transactionClassification.count({
      where: { tenantId, status: TransactionStatus.review },
    });
  }

  async getReviewQueue(
    tenantId: string,
    page: number,
    limit: number,
    opts?: { search?: string; minConfidence?: number; maxConfidence?: number },
  ) {
    const { skip } = paginateParams(page, limit);
    const search = opts?.search?.trim();
    const { minConfidence, maxConfidence } = opts ?? {};

    const where: Prisma.TransactionClassificationWhereInput = {
      tenantId,
      status: TransactionStatus.review,
      ...(search
        ? { transaction: { is: { content: { contains: search, mode: 'insensitive' } } } }
        : {}),
      ...(minConfidence != null || maxConfidence != null
        ? {
            confidenceScore: {
              ...(minConfidence != null ? { gte: minConfidence } : {}),
              ...(maxConfidence != null ? { lt: maxConfidence } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.transactionClassification.findMany({
        where,
        include: {
          transaction: {
            select: { id: true, content: true, amount: true, transactionDate: true, grantId: true },
          },
        },
        orderBy: [{ transaction: { transactionDate: 'desc' } }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.transactionClassification.count({ where }),
    ]);

    return paginateResult(items, total, page, limit);
  }

  async confirm(tenantId: string, classificationId: string, userId: string, source?: 'copilot') {
    const classification = await this.findInQueue(tenantId, classificationId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.transactionClassification.updateMany({
        where: { id: classificationId, status: TransactionStatus.review },
        data: {
          status: TransactionStatus.classified,
          classificationType: ClassificationType.manual,
          classifiedBy: userId,
        },
      });
      if (count === 0) {
        throw new ConflictException('Giao dịch đã được xử lý bởi người khác, vui lòng tải lại');
      }
      await tx.transaction.update({
        where: { id: classification.transactionId },
        data: { status: TransactionStatus.classified },
      });
      await createAuditLog(tx, {
        tenantId,
        entityType: 'transaction_classification',
        entityId: classificationId,
        action: 'review_confirmed',
        actor: userId,
        afterState: source ? { action: 'confirm', source } : { action: 'confirm' },
      });
    });

    this.triggerEmbedding(classificationId, classification.transaction?.content, tenantId);
  }

  async correct(
    tenantId: string,
    classificationId: string,
    userId: string,
    dto: CorrectClassificationDto,
  ) {
    const classification = await this.findInQueue(tenantId, classificationId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.transactionClassification.updateMany({
        where: { id: classificationId, status: TransactionStatus.review },
        data: {
          debitAccount: dto.debitAccount,
          creditAccount: dto.creditAccount,
          status: TransactionStatus.classified,
          classificationType: ClassificationType.manual,
          classifiedBy: userId,
          confidenceScore: 100,
        },
      });
      if (count === 0) {
        throw new ConflictException('Giao dịch đã được xử lý bởi người khác, vui lòng tải lại');
      }
      await tx.transaction.update({
        where: { id: classification.transactionId },
        data: { status: TransactionStatus.classified },
      });
      await createAuditLog(tx, {
        tenantId,
        entityType: 'transaction_classification',
        entityId: classificationId,
        action: 'review_corrected',
        actor: userId,
        beforeState: {
          debitAccount: classification.debitAccount,
          creditAccount: classification.creditAccount,
        },
        afterState: dto.source
          ? {
              debitAccount: dto.debitAccount,
              creditAccount: dto.creditAccount,
              source: dto.source,
            }
          : { debitAccount: dto.debitAccount, creditAccount: dto.creditAccount },
      });
    });

    this.triggerEmbedding(classificationId, classification.transaction?.content, tenantId);
  }

  async skip(tenantId: string, classificationId: string, userId: string) {
    const classification = await this.findInQueue(tenantId, classificationId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.transactionClassification.updateMany({
        where: { id: classificationId, status: TransactionStatus.review },
        data: { status: TransactionStatus.skipped },
      });
      if (count === 0) {
        throw new ConflictException('Giao dịch đã được xử lý bởi người khác, vui lòng tải lại');
      }
      await tx.transaction.update({
        where: { id: classification.transactionId },
        data: { status: TransactionStatus.skipped },
      });
      await createAuditLog(tx, {
        tenantId,
        entityType: 'transaction_classification',
        entityId: classificationId,
        action: 'review_skipped',
        actor: userId,
        afterState: { action: 'skip' },
      });
    });
  }

  async overrideClassification(
    tenantId: string,
    transactionId: string,
    userId: string,
    dto: CorrectClassificationDto,
  ) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id: transactionId, tenantId },
    });
    if (!transaction) throw new NotFoundException('Giao dịch không tồn tại');

    const existing = await this.prisma.transactionClassification.findUnique({
      where: { transactionId },
    });

    if (existing) {
      const updated = await this.prisma.transactionClassification.update({
        where: { id: existing.id },
        data: {
          debitAccount: dto.debitAccount,
          creditAccount: dto.creditAccount,
          classificationType: ClassificationType.manual,
          classifiedBy: userId,
          confidenceScore: 100,
          status: TransactionStatus.classified,
        },
      });
      this.triggerEmbedding(updated.id, transaction.content, tenantId);
      return updated;
    }

    const created = await this.prisma.transactionClassification.create({
      data: {
        tenantId,
        transactionId,
        debitAccount: dto.debitAccount,
        creditAccount: dto.creditAccount,
        amount: new Prisma.Decimal(Math.abs(Number(transaction.amount))),
        confidenceScore: 100,
        classificationType: ClassificationType.manual,
        classifiedBy: userId,
        reason: 'Ghi đè thủ công',
        status: TransactionStatus.classified,
      },
    });
    this.triggerEmbedding(created.id, transaction.content, tenantId);
    return created;
  }

  // ── Copilot tool methods (soft returns, no HTTP exceptions) ──────────────

  async getCopilotReviewQueueCount(tenantId: string, year?: number, month?: number) {
    return {
      count: await this.prisma.transactionClassification.count({
        where: this.copilotReviewQueueWhere(tenantId, year, month),
      }),
      ...(year != null && month != null ? { period: { year, month } } : { scope: 'all' as const }),
    };
  }

  async listCopilotReviewQueue(tenantId: string, limit = 10, year?: number, month?: number) {
    const take = Math.min(20, Math.max(1, Number(limit) || 10));
    const where = this.copilotReviewQueueWhere(tenantId, year, month);

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

  async proposeConfirmClassification(tenantId: string, transactionId: string, role: Role) {
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

  async proposeCorrectClassification(
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

  private copilotReviewQueueWhere(tenantId: string, year?: number, month?: number) {
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

  private async findInQueue(tenantId: string, classificationId: string) {
    const classification = await this.prisma.transactionClassification.findFirst({
      where: { id: classificationId, tenantId, status: TransactionStatus.review },
      include: { transaction: { select: { content: true } } },
    });
    if (!classification) throw new NotFoundException('Không tìm thấy mục cần review');
    return classification;
  }

  private triggerEmbedding(
    classificationId: string,
    content: string | null | undefined,
    tenantId: string,
  ): void {
    if (!content) return;
    this.embeddingService
      .embedAndStoreClassification(classificationId, content, tenantId)
      .catch((err: unknown) =>
        this.logger.warn(`Embedding failed for classification ${classificationId}`, err),
      );
  }
}
