import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CopilotActivity,
  CopilotConversationDetail,
  CopilotConversationsListResponse,
} from '@xcash/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiService } from './openai.service';

function isSafeHttpUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://');
}

function sanitizeActivities(activities: CopilotActivity[]): CopilotActivity[] {
  return activities.slice(0, 10).map((a) => ({
    ...a,
    snippet: a.snippet?.slice(0, 300),
    urls: a.urls?.filter(isSafeHttpUrl).slice(0, 5),
  }));
}

@Injectable()
export class CopilotConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
  ) {}

  async findOrCreate(tenantId: string, userId: string, conversationId?: string) {
    if (conversationId) {
      const conv = await this.prisma.copilotConversation.findFirst({
        where: { id: conversationId, userId, tenantId },
      });
      if (!conv) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
      return conv;
    }
    return this.prisma.copilotConversation.create({ data: { tenantId, userId } });
  }

  async saveUserMessage(conversationId: string, content: string) {
    return this.prisma.copilotMessage.create({
      data: { conversationId, role: 'user', content },
    });
  }

  async saveAssistantMessage(
    conversationId: string,
    content: string,
    activities: CopilotActivity[],
    isPartial = false,
  ) {
    const sanitized = sanitizeActivities(activities);
    return this.prisma.copilotMessage.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
        activities: sanitized.length > 0 ? (sanitized as object[]) : undefined,
        isPartial,
      },
    });
  }

  async deleteMessage(id: string): Promise<void> {
    await this.prisma.copilotMessage.delete({ where: { id } }).catch(() => {});
  }

  async getHistoryForContext(
    conversationId: string,
    excludeMessageId: string,
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = await this.prisma.copilotMessage.findMany({
      where: { conversationId, id: { not: excludeMessageId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });
    return messages.reverse().map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }

  triggerAutoTitle(conversationId: string, firstMessage: string, tenantId?: string): void {
    void this.openAiService
      .generateCopilotTitle(firstMessage, tenantId, conversationId)
      .then((title) =>
        this.prisma.copilotConversation.update({
          where: { id: conversationId },
          data: { title },
        }),
      )
      .catch(() => {});
  }

  private buildConversationWhere(
    tenantId: string,
    userId: string,
    fromDate?: string,
    toDate?: string,
  ) {
    const updatedAt: { gte?: Date; lte?: Date } = {};
    if (fromDate) updatedAt.gte = new Date(`${fromDate}T00:00:00`);
    if (toDate) updatedAt.lte = new Date(`${toDate}T23:59:59`);

    return {
      tenantId,
      userId,
      ...(fromDate || toDate ? { updatedAt } : {}),
    };
  }

  private mapConversationRows(
    conversations: Array<{
      id: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
      _count: { messages: number };
      messages: Array<{ content: string; role: string }>;
    }>,
  ) {
    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messageCount: c._count.messages,
      lastMessage: (
        c.messages.find((m) => m.role === 'assistant') ?? c.messages[0]
      )?.content?.slice(0, 80),
    }));
  }

  async listConversations(
    tenantId: string,
    userId: string,
    options: {
      limit?: number;
      before?: string;
      page?: number;
      fromDate?: string;
      toDate?: string;
    } = {},
  ): Promise<CopilotConversationsListResponse> {
    const take = Math.min(options.limit ?? 20, 50);
    const include = {
      _count: { select: { messages: true } },
      messages: {
        orderBy: { createdAt: 'desc' as const },
        take: 5,
        select: { content: true, role: true },
      },
    };

    if (options.page != null) {
      const where = this.buildConversationWhere(tenantId, userId, options.fromDate, options.toDate);
      const skip = (options.page - 1) * take;
      const [total, conversations] = await Promise.all([
        this.prisma.copilotConversation.count({ where }),
        this.prisma.copilotConversation.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          skip,
          take,
          include,
        }),
      ]);
      const totalPages = Math.max(1, Math.ceil(total / take));

      return {
        items: this.mapConversationRows(conversations),
        hasMore: options.page < totalPages,
        cursorNext: null,
        total,
        page: options.page,
        limit: take,
        totalPages,
      };
    }

    const conversations = await this.prisma.copilotConversation.findMany({
      where: this.buildConversationWhere(tenantId, userId),
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      ...(options.before ? { cursor: { id: options.before }, skip: 1 } : {}),
      take: take + 1,
      include,
    });

    const hasMore = conversations.length > take;
    const items = hasMore ? conversations.slice(0, take) : conversations;

    return {
      items: this.mapConversationRows(items),
      hasMore,
      cursorNext: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }

  async getConversation(
    id: string,
    userId: string,
    limit = 10,
    before?: string,
  ): Promise<CopilotConversationDetail> {
    const conv = await this.prisma.copilotConversation.findFirst({
      where: { id, userId },
    });
    if (!conv) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');

    const take = Math.min(limit, 50);

    let messages: Awaited<ReturnType<typeof this.prisma.copilotMessage.findMany>>;

    if (before) {
      const cursor = await this.prisma.copilotMessage.findFirst({
        where: { id: before, conversationId: id },
      });
      if (!cursor) {
        messages = await this.prisma.copilotMessage.findMany({
          where: { conversationId: id },
          orderBy: { createdAt: 'desc' },
          take: take + 1,
        });
      } else {
        messages = await this.prisma.copilotMessage.findMany({
          where: { conversationId: id },
          orderBy: { createdAt: 'desc' },
          cursor: { id: before },
          skip: 1,
          take: take + 1,
        });
      }
    } else {
      messages = await this.prisma.copilotMessage.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
      });
    }

    const hasMore = messages.length > take;
    const items = (hasMore ? messages.slice(0, take) : messages).reverse();

    return {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: items.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        activities: (m.activities as CopilotActivity[] | null) ?? undefined,
        createdAt: m.createdAt.toISOString(),
        isPartial: m.isPartial,
      })),
      hasMore,
      oldestMessageId: items[0]?.id ?? null,
    };
  }

  async renameConversation(id: string, userId: string, title: string) {
    const conv = await this.prisma.copilotConversation.findFirst({
      where: { id, userId },
    });
    if (!conv) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    return this.prisma.copilotConversation.update({ where: { id }, data: { title } });
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const conv = await this.prisma.copilotConversation.findFirst({
      where: { id, userId },
    });
    if (!conv) throw new NotFoundException('Không tìm thấy cuộc trò chuyện');
    await this.prisma.copilotConversation.delete({ where: { id } });
  }
}
