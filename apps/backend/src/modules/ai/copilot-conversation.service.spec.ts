import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CopilotConversationService } from './copilot-conversation.service';
import { OpenAiService } from './openai.service';

describe('CopilotConversationService', () => {
  let service: CopilotConversationService;

  const prisma = {
    copilotConversation: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    copilotMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  const openAiService = {
    generateCopilotTitle: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotConversationService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAiService, useValue: openAiService },
      ],
    }).compile();

    service = module.get(CopilotConversationService);
  });

  it('findOrCreate throws 404 when conversationId belongs to another user', async () => {
    prisma.copilotConversation.findFirst.mockResolvedValue(null);

    await expect(service.findOrCreate('tenant-1', 'user-1', 'conv-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('findOrCreate creates conversation when conversationId is omitted', async () => {
    prisma.copilotConversation.create.mockResolvedValue({
      id: 'conv-new',
      tenantId: 'tenant-1',
      userId: 'user-1',
      title: 'Cuộc chat mới',
    });

    const conv = await service.findOrCreate('tenant-1', 'user-1');

    expect(conv.id).toBe('conv-new');
    expect(prisma.copilotConversation.create).toHaveBeenCalledWith({
      data: { tenantId: 'tenant-1', userId: 'user-1' },
    });
  });

  it('saveAssistantMessage strips unsafe URLs from activities', async () => {
    prisma.copilotMessage.create.mockResolvedValue({ id: 'msg-1' });

    await service.saveAssistantMessage('conv-1', 'reply', [
      {
        kind: 'web_search',
        label: 'Web',
        urls: ['https://example.com', 'javascript:alert(1)'],
      },
    ]);

    expect(prisma.copilotMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activities: [
            expect.objectContaining({
              urls: ['https://example.com'],
            }),
          ],
        }),
      }),
    );
  });

  it('listConversations returns cursor pagination metadata', async () => {
    const updatedAt = new Date('2026-07-07T10:00:00.000Z');
    prisma.copilotConversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        title: 'Chat A',
        createdAt: updatedAt,
        updatedAt,
        _count: { messages: 2 },
        messages: [{ content: 'assistant reply', role: 'assistant' }],
      },
      {
        id: 'conv-2',
        title: 'Chat B',
        createdAt: updatedAt,
        updatedAt,
        _count: { messages: 1 },
        messages: [{ content: 'user question', role: 'user' }],
      },
    ]);

    const result = await service.listConversations('tenant-1', 'user-1', { limit: 1 });

    expect(result.hasMore).toBe(true);
    expect(result.cursorNext).toBe('conv-1');
    expect(result.items[0]?.lastMessage).toBe('assistant reply');
    expect(prisma.copilotConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  it('listConversations returns offset pagination metadata when page is set', async () => {
    const updatedAt = new Date('2026-07-07T10:00:00.000Z');
    prisma.copilotConversation.count.mockResolvedValue(25);
    prisma.copilotConversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        title: 'Chat A',
        createdAt: updatedAt,
        updatedAt,
        _count: { messages: 2 },
        messages: [{ content: 'assistant reply', role: 'assistant' }],
      },
    ]);

    const result = await service.listConversations('tenant-1', 'user-1', {
      page: 2,
      limit: 10,
      fromDate: '2026-07-01',
      toDate: '2026-07-07',
    });

    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.cursorNext).toBeNull();
    expect(prisma.copilotConversation.count).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        updatedAt: {
          gte: new Date('2026-07-01T00:00:00'),
          lte: new Date('2026-07-07T23:59:59'),
        },
      },
    });
    expect(prisma.copilotConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
  });

  it('getHistoryForContext excludes the current user message id', async () => {
    prisma.copilotMessage.findMany.mockResolvedValue([
      { role: 'assistant', content: 'prev reply' },
    ]);

    const history = await service.getHistoryForContext('conv-1', 'msg-current');

    expect(history).toEqual([{ role: 'assistant', content: 'prev reply' }]);
    expect(prisma.copilotMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conv-1', id: { not: 'msg-current' } },
        take: 10,
      }),
    );
  });
});
