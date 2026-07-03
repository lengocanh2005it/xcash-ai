import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassificationType, Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CorrectClassificationDto } from './dto/review.dto';

@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getReviewQueue(tenantId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { tenantId, status: TransactionStatus.review };

    const [items, total] = await Promise.all([
      this.prisma.transactionClassification.findMany({
        where,
        include: {
          transaction: {
            select: { content: true, amount: true, transactionDate: true, grantId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transactionClassification.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async confirm(tenantId: string, classificationId: string, userId: string) {
    const classification = await this.findInQueue(tenantId, classificationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.transactionClassification.update({
        where: { id: classificationId },
        data: {
          status: TransactionStatus.classified,
          classificationType: ClassificationType.manual,
          classifiedBy: userId,
        },
      });
      await tx.transaction.update({
        where: { id: classification.transactionId },
        data: { status: TransactionStatus.classified },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: 'transaction_classification',
          entityId: classificationId,
          action: 'review_confirmed',
          actor: userId,
          afterState: { action: 'confirm' },
        },
      });
    });
  }

  async correct(
    tenantId: string,
    classificationId: string,
    userId: string,
    dto: CorrectClassificationDto,
  ) {
    const classification = await this.findInQueue(tenantId, classificationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.transactionClassification.update({
        where: { id: classificationId },
        data: {
          debitAccount: dto.debitAccount,
          creditAccount: dto.creditAccount,
          status: TransactionStatus.classified,
          classificationType: ClassificationType.manual,
          classifiedBy: userId,
          confidenceScore: 100,
        },
      });
      await tx.transaction.update({
        where: { id: classification.transactionId },
        data: { status: TransactionStatus.classified },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: 'transaction_classification',
          entityId: classificationId,
          action: 'review_corrected',
          actor: userId,
          beforeState: {
            debitAccount: classification.debitAccount,
            creditAccount: classification.creditAccount,
          },
          afterState: { debitAccount: dto.debitAccount, creditAccount: dto.creditAccount },
        },
      });
    });
  }

  async skip(tenantId: string, classificationId: string, userId: string) {
    const classification = await this.findInQueue(tenantId, classificationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.transactionClassification.update({
        where: { id: classificationId },
        data: { status: TransactionStatus.skipped },
      });
      await tx.transaction.update({
        where: { id: classification.transactionId },
        data: { status: TransactionStatus.skipped },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: 'transaction_classification',
          entityId: classificationId,
          action: 'review_skipped',
          actor: userId,
          afterState: { action: 'skip' },
        },
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
      return this.prisma.transactionClassification.update({
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
    }

    return this.prisma.transactionClassification.create({
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
  }

  private async findInQueue(tenantId: string, classificationId: string) {
    const classification = await this.prisma.transactionClassification.findFirst({
      where: { id: classificationId, tenantId, status: TransactionStatus.review },
    });
    if (!classification) throw new NotFoundException('Không tìm thấy mục cần review');
    return classification;
  }
}
