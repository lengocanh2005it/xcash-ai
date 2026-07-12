import { Injectable, Logger } from '@nestjs/common';
import { AiUsageLogService } from './ai-usage-log.service';
import { OpenAiService } from './openai.service';
import { isQuotaOrBillingError, shouldFallbackProvider } from './utils/llm-error.util';

@Injectable()
export class EmbeddingProviderService {
  private readonly logger = new Logger(EmbeddingProviderService.name);

  constructor(
    private readonly openAiService: OpenAiService,
    private readonly aiUsageLogService: AiUsageLogService,
  ) {}

  isConfigured(): boolean {
    return this.openAiService.isConfigured();
  }

  async createEmbedding(text: string, tenantId?: string): Promise<number[] | null> {
    if (!text.trim()) return null;

    if (this.openAiService.client) {
      try {
        const response = await this.openAiService.client.embeddings.create({
          model: this.openAiService.embeddingModel,
          input: text.trim(),
        });
        if (tenantId && response.usage) {
          this.aiUsageLogService.record({
            tenantId,
            callType: 'embedding',
            model: this.openAiService.embeddingModel,
            tokensIn: response.usage.total_tokens,
            tokensOut: 0,
          });
        }
        return response.data[0]?.embedding ?? null;
      } catch (err) {
        if (shouldFallbackProvider(err) && this.openAiService.jinaClient) {
          const reason = isQuotaOrBillingError(err)
            ? 'OpenAI hết quota/credit, chuyển Jina ngay'
            : 'OpenAI embedding failed, falling back to Jina';
          this.logger.warn(`${reason}: ${err instanceof Error ? err.message : String(err)}`);
        } else {
          throw err;
        }
      }
    }

    if (this.openAiService.jinaClient) {
      const response = await this.openAiService.jinaClient.embeddings.create({
        model: this.openAiService.jinaModel,
        input: text.trim(),
      });
      if (tenantId && response.usage) {
        this.aiUsageLogService.record({
          tenantId,
          callType: 'embedding',
          model: this.openAiService.jinaModel,
          tokensIn: response.usage.total_tokens,
          tokensOut: 0,
        });
      }
      return response.data[0]?.embedding ?? null;
    }

    return null;
  }
}
