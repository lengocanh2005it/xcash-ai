import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import {
  hasStrongKeywordKnowledgeMatch,
  type KnowledgeSearchResult,
  searchKnowledgeByKeyword,
} from './knowledge';
import { OpenAiService } from './openai.service';

@Injectable()
export class CopilotKnowledgeService {
  private readonly logger = new Logger(CopilotKnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly openAiService: OpenAiService,
    private readonly configService: ConfigService,
  ) {}

  async searchKnowledge(query: string): Promise<KnowledgeSearchResult> {
    if (!query.trim()) return { sections: [], query, totalFound: 0 };

    const keywordResult = searchKnowledgeByKeyword(query);
    if (hasStrongKeywordKnowledgeMatch(query)) {
      return keywordResult;
    }

    if (!this.openAiService.isConfigured()) return keywordResult;

    try {
      const vector = await this.getOrCreateQueryEmbedding(query);
      if (!vector) return keywordResult;

      const vectorStr = `[${vector.join(',')}]`;
      const rows = await this.prisma.$queryRaw<
        Array<{ section_id: string; title: string; content: string; distance: number }>
      >`
        SELECT section_id, title, content, embedding <=> ${vectorStr}::vector AS distance
        FROM knowledge_embeddings
        ORDER BY distance ASC
        LIMIT 2
      `;

      if (rows.length === 0) return keywordResult;

      return {
        sections: rows.map((r) => ({ id: r.section_id, title: r.title, content: r.content })),
        query,
        totalFound: rows.length,
      };
    } catch (err) {
      this.logger.warn(
        `pgvector knowledge search thất bại, dùng keyword fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
      return keywordResult;
    }
  }

  private async getOrCreateQueryEmbedding(query: string): Promise<number[] | null> {
    const normalized = query.trim().toLowerCase();
    const cacheKey = `copilot:embed:${createHash('sha256').update(normalized).digest('hex')}`;

    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) return JSON.parse(cached) as number[];
    } catch {
      // cache miss — proceed to OpenAI
    }

    const vector = await this.openAiService.createEmbedding(query);
    if (!vector) return null;

    try {
      const ttl = this.configService.get<number>('COPILOT_EMBEDDING_CACHE_TTL_SECONDS', 3600);
      await this.redisService.set(cacheKey, JSON.stringify(vector), 'EX', ttl);
    } catch {
      // non-critical
    }

    return vector;
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
    const cached = await this.redisService.get(cacheKey);
    if (cached) return JSON.parse(cached) as object;

    const apiKey = this.configService.get<string>('TAVILY_API_KEY', '');
    if (!apiKey) {
      this.logger.warn('TAVILY_API_KEY chưa cấu hình — search_casso_public bị bỏ qua');
      return { results: [], disclaimer: 'Tính năng tìm kiếm chưa được cấu hình.' };
    }

    const { tavily } = await import('@tavily/core');
    const client = tavily({ apiKey });

    const timeoutMs = this.configService.get<number>('TAVILY_TIMEOUT_MS', 3000);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Tavily search timeout')), timeoutMs),
    );
    let response: Awaited<ReturnType<typeof client.search>>;
    try {
      response = await Promise.race([
        client.search(`${safeQuery} site:casso.vn`, {
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

    await this.redisService.set(cacheKey, JSON.stringify(payload), 'EX', 86400);
    return payload;
  }
}
