import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CopilotConversationDetail,
  CopilotConversationSummary,
  CopilotConversationsListResponse,
} from '@xcash/shared-types';
import { useCallback, useMemo } from 'react';
import { api } from '@/lib/api';

function provisionalTitleFromMessage(text: string): string {
  const plain = text.trim().replace(/\s+/g, ' ');
  if (!plain) return 'Cuộc chat mới';
  const words = plain.split(' ').slice(0, 6).join(' ');
  return words.length > 48 ? `${words.slice(0, 48).trimEnd()}...` : words;
}

function patchConversationList(
  old: InfiniteData<CopilotConversationsListResponse> | undefined,
  conversationId: string,
  patch: Partial<CopilotConversationSummary>,
): InfiniteData<CopilotConversationsListResponse> | undefined {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === conversationId ? { ...item, ...patch } : item)),
    })),
  };
}

function prependConversationSummary(
  old: InfiniteData<CopilotConversationsListResponse> | undefined,
  item: CopilotConversationSummary,
): InfiniteData<CopilotConversationsListResponse> {
  if (!old?.pages.length) {
    return {
      pages: [{ items: [item], hasMore: false, cursorNext: null }],
      pageParams: [undefined],
    };
  }
  const [first, ...rest] = old.pages;
  return {
    ...old,
    pages: [
      {
        ...first,
        items: [item, ...first.items.filter((i) => i.id !== item.id)],
      },
      ...rest,
    ],
  };
}

export function useCopilotConversations(userId?: string) {
  const qc = useQueryClient();

  const infiniteQuery = useInfiniteQuery<CopilotConversationsListResponse>({
    queryKey: ['copilot-conversations', userId],
    queryFn: async ({ pageParam }) => {
      const before = pageParam as string | undefined;
      const url = before
        ? `/ai/copilot/conversations?before=${before}`
        : '/ai/copilot/conversations';
      const res = await api.get<{ data: CopilotConversationsListResponse }>(url);
      return res.data.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.cursorNext ? lastPage.cursorNext : undefined,
    enabled: !!userId,
    staleTime: 30_000,
  });

  const items = useMemo(
    () => infiniteQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [infiniteQuery.data],
  );

  const invalidateList = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['copilot-conversations', userId] });
  }, [qc, userId]);

  const invalidateCopilotUsage = useCallback(() => {
    qc.setQueryData<{ copilotUsed: number; copilotQuota: number }>(
      ['billing', 'current-plan'],
      (old) => {
        if (!old || old.copilotQuota === -1) return old;
        return { ...old, copilotUsed: old.copilotUsed + 1 };
      },
    );
    qc.invalidateQueries({ queryKey: ['billing', 'current-plan'] });
  }, [qc]);

  /** Sau chat: cập nhật sidebar ngay + refetch khi auto-title LLM xong (fire-and-forget BE). */
  const refreshListAfterChat = useCallback(
    (opts: { conversationId: string; firstMessage: string; isNewConversation: boolean }) => {
      const { conversationId, firstMessage, isNewConversation } = opts;
      const now = new Date().toISOString();
      const provisionalTitle = provisionalTitleFromMessage(firstMessage);

      if (isNewConversation) {
        qc.setQueryData<InfiniteData<CopilotConversationsListResponse>>(
          ['copilot-conversations', userId],
          (old) => {
            const exists = old?.pages.some((p) => p.items.some((i) => i.id === conversationId));
            const summary: CopilotConversationSummary = {
              id: conversationId,
              title: provisionalTitle,
              createdAt: now,
              updatedAt: now,
              messageCount: 2,
              lastMessage: firstMessage,
            };
            if (!exists) return prependConversationSummary(old, summary);
            return patchConversationList(old, conversationId, {
              title: provisionalTitle,
              lastMessage: firstMessage,
              updatedAt: now,
            });
          },
        );
      }

      invalidateList();
      invalidateCopilotUsage();

      if (isNewConversation) {
        window.setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['copilot-conversations', userId] });
        }, 2_000);
        window.setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['copilot-conversations', userId] });
        }, 5_000);
      }
    },
    [invalidateCopilotUsage, invalidateList, qc, userId],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await api.delete(`/ai/copilot/conversations/${id}`);
      qc.invalidateQueries({ queryKey: ['copilot-conversations', userId] });
    },
    [qc, userId],
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      await api.patch(`/ai/copilot/conversations/${id}`, { title });
      qc.invalidateQueries({ queryKey: ['copilot-conversations', userId] });
    },
    [qc, userId],
  );

  const loadConversation = useCallback(async (id: string): Promise<CopilotConversationDetail> => {
    const res = await api.get<{ data: CopilotConversationDetail }>(
      `/ai/copilot/conversations/${id}`,
    );
    return res.data.data;
  }, []);

  const loadOlderMessages = useCallback(
    async (id: string, before: string): Promise<CopilotConversationDetail> => {
      const res = await api.get<{ data: CopilotConversationDetail }>(
        `/ai/copilot/conversations/${id}?before=${before}`,
      );
      return res.data.data;
    },
    [],
  );

  return {
    ...infiniteQuery,
    items,
    invalidateList,
    refreshListAfterChat,
    deleteConversation,
    renameConversation,
    loadConversation,
    loadOlderMessages,
  };
}
