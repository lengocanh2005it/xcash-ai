import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClassificationType, Prisma, TransactionStatus } from '@prisma/client';
import { createAuditLog } from '../../common/util/audit-log.util';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { EmbeddingService } from './embedding.service';
import { OpenAiService } from './openai.service';
import { ruleBasedClassify } from './rule-based-classification.util';
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
export class TransactionClassifierService {
  private readonly logger = new Logger(TransactionClassifierService.name);

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
      : ruleBasedClassify(content, direction);

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

      await createAuditLog(tx, {
        tenantId: transaction.tenantId,
        entityType: 'transaction_classification',
        entityId: created.id,
        action: autoClassified ? 'ai_auto_classify' : 'ai_queued_review',
        actor: 'ai',
        afterState: { debitAccount, creditAccount, confidenceScore, reason },
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
}
