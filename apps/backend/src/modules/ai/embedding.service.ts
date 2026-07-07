import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { FewShotExample } from './openai.service';
import { OpenAiService } from './openai.service';

export interface ClassificationSimilarityRow {
  transaction_content: string;
  debit_account: string;
  credit_account: string;
  similarity: number;
}

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
  ) {}

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  async embedAndStoreClassification(
    classificationId: string,
    content: string,
    tenantId?: string,
  ): Promise<void> {
    const embedding = await this.openAiService.createEmbedding(content, tenantId);
    if (!embedding) return;

    const vectorLiteral = this.toVectorLiteral(embedding);
    // id/tenant_id là cột `text` (Prisma String, không @db.Uuid) → không cast ::uuid.
    await this.prisma.$executeRawUnsafe(
      'UPDATE transaction_classifications SET embedding = $1::vector WHERE id = $2',
      vectorLiteral,
      classificationId,
    );
  }

  async findSimilarClassifications(
    tenantId: string,
    content: string,
    limit = 5,
  ): Promise<FewShotExample[]> {
    const embedding = await this.openAiService.createEmbedding(content, tenantId);
    if (!embedding) return [];

    const vectorLiteral = this.toVectorLiteral(embedding);

    const rows = await this.prisma.$queryRawUnsafe<ClassificationSimilarityRow[]>(
      `SELECT t.content AS transaction_content, tc.debit_account, tc.credit_account,
              1 - (tc.embedding <=> $1::vector) AS similarity
       FROM transaction_classifications tc
       INNER JOIN transactions t ON t.id = tc.transaction_id
       WHERE tc.tenant_id = $2
         AND tc.embedding IS NOT NULL
         AND tc.status = 'classified'
       ORDER BY tc.embedding <=> $1::vector
       LIMIT $3`,
      vectorLiteral,
      tenantId,
      limit,
    );

    return rows.map((row) => ({
      content: row.transaction_content,
      debitAccount: row.debit_account,
      creditAccount: row.credit_account,
    }));
  }
}
