import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassificationType, Prisma, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';
import { preprocessTransactionContent } from './utils/text-preprocessing';

function resolveDirection(transaction: {
  source: string;
  direction: string;
  amount: unknown;
}): 'in' | 'out' {
  if (transaction.source === 'import') {
    return transaction.direction as 'in' | 'out';
  }
  return Number(transaction.amount) >= 0 ? 'in' : 'out';
}

export interface ClassificationOutput {
  transactionId: string;
  debitAccount: string;
  creditAccount: string;
  confidenceScore: number;
  reason: string;
  autoClassified: boolean;
  status: TransactionStatus;
}

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {}

  async processTransaction(transactionDbId: string): Promise<ClassificationOutput | null> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: transactionDbId },
    });

    if (!transaction || transaction.status !== TransactionStatus.pending) {
      return null;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: transaction.tenantId },
    });

    const threshold = tenant?.classificationThreshold ?? this.getDefaultThreshold();
    const content = transaction.content ?? '';
    const normalizedContent = preprocessTransactionContent(content);
    const amount = Number(transaction.amount);
    const direction = resolveDirection(transaction);

    const fewShotExamples = await this.embeddingService.findSimilarClassifications(
      transaction.tenantId,
      normalizedContent || content,
      5,
    );

    const aiResult = await this.openAiService.classifyTransaction(
      content,
      amount,
      direction,
      fewShotExamples,
      transaction.senderAccount,
      transaction.receiverAccount,
      transaction.transactionDate,
      transaction.tenantId,
      transaction.id,
    );

    const { debitAccount, creditAccount, confidenceScore, reason } = aiResult
      ? {
          debitAccount: aiResult.debitAccount,
          creditAccount: aiResult.creditAccount,
          confidenceScore: aiResult.confidence,
          reason: aiResult.reason,
        }
      : this.ruleBased(content, direction);

    const autoClassified = confidenceScore >= threshold;
    const status = autoClassified ? TransactionStatus.classified : TransactionStatus.review;

    const classification = await this.prisma.$transaction(async (tx) => {
      const created = await tx.transactionClassification.create({
        data: {
          tenantId: transaction.tenantId,
          transactionId: transaction.id,
          debitAccount,
          creditAccount,
          amount: new Prisma.Decimal(Math.abs(amount)),
          confidenceScore,
          classificationType: autoClassified ? ClassificationType.auto : ClassificationType.manual,
          classifiedBy: 'ai',
          reason,
          status,
        },
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          tenantId: transaction.tenantId,
          entityType: 'transaction_classification',
          entityId: created.id,
          action: autoClassified ? 'ai_auto_classify' : 'ai_queued_review',
          actor: 'ai',
          afterState: { debitAccount, creditAccount, confidenceScore, reason },
        },
      });

      return created;
    });

    this.notificationService.emitTransactionClassified(
      transaction.tenantId,
      transaction.id,
      status as 'classified' | 'review',
    );

    if (status === TransactionStatus.review) {
      await this.notificationService
        .createReviewNeeded(
          transaction.tenantId,
          transaction.id,
          transaction.content,
          confidenceScore,
        )
        .catch((err: unknown) =>
          this.logger.warn(`Failed to create review notification for ${transaction.id}`, err),
        );
    }

    // Store embedding asynchronously (non-blocking)
    this.embeddingService
      .embedAndStoreClassification(
        classification.id,
        normalizedContent || content,
        transaction.tenantId,
      )
      .catch((err: unknown) =>
        this.logger.warn(`Embedding storage failed for ${classification.id}`, err),
      );

    this.logger.log(
      `Transaction ${transaction.id}: ${debitAccount}/${creditAccount} — ${confidenceScore}% (${autoClassified ? 'auto' : 'review'})`,
    );

    return {
      transactionId: transaction.id,
      debitAccount,
      creditAccount,
      confidenceScore,
      reason,
      autoClassified,
      status,
    };
  }

  private getDefaultThreshold(): number {
    return Number.parseInt(this.configService.get<string>('AI_CLASSIFICATION_THRESHOLD', '85'), 10);
  }

  private ruleBased(
    content: string,
    direction: 'in' | 'out',
  ): { debitAccount: string; creditAccount: string; confidenceScore: number; reason: string } {
    const upper = content.toUpperCase();

    if (direction === 'in') {
      if (
        upper.includes('TIEN HANG') ||
        upper.includes('THANH TOAN') ||
        upper.includes('TT HANG')
      ) {
        return {
          debitAccount: '112',
          creditAccount: '511',
          confidenceScore: 55,
          reason: 'Tiền hàng vào — gợi ý doanh thu bán hàng',
        };
      }
      if (upper.includes('LAI') || upper.includes('INTEREST')) {
        return {
          debitAccount: '112',
          creditAccount: '515',
          confidenceScore: 60,
          reason: 'Lãi tiền gửi — gợi ý doanh thu tài chính',
        };
      }
      return {
        debitAccount: '112',
        creditAccount: '131',
        confidenceScore: 30,
        reason: 'Tiền vào chưa xác định — cần xem xét',
      };
    }

    if (upper.includes('LUONG') || upper.includes('SALARY') || upper.includes('TRA LUONG')) {
      return {
        debitAccount: '334',
        creditAccount: '112',
        confidenceScore: 65,
        reason: 'Chi trả lương nhân viên',
      };
    }
    if (upper.includes('HOA DON') || upper.includes('DIEN') || upper.includes('NUOC')) {
      return {
        debitAccount: '627',
        creditAccount: '112',
        confidenceScore: 55,
        reason: 'Chi phí điện nước — gợi ý chi phí sản xuất chung',
      };
    }
    if (upper.includes('VAN PHONG') || upper.includes('OFFICE')) {
      return {
        debitAccount: '642',
        creditAccount: '112',
        confidenceScore: 55,
        reason: 'Chi phí văn phòng — gợi ý chi phí quản lý',
      };
    }
    if (upper.includes('PHI') || upper.includes('FEE')) {
      return {
        debitAccount: '635',
        creditAccount: '112',
        confidenceScore: 50,
        reason: 'Phí ngân hàng — gợi ý chi phí tài chính',
      };
    }

    return {
      debitAccount: '331',
      creditAccount: '112',
      confidenceScore: 25,
      reason: 'Tiền ra chưa xác định — cần xem xét',
    };
  }
}
