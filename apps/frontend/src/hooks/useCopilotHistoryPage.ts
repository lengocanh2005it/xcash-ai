import { useQuery } from '@tanstack/react-query';
import type { CopilotConversationsListResponse } from '@xcash/shared-types';
import { api } from '@/lib/api';

const DEFAULT_LIMIT = 10;

export function useCopilotHistoryPage(opts: {
  userId?: string;
  page: number;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}) {
  const limit = opts.limit ?? DEFAULT_LIMIT;

  return useQuery<CopilotConversationsListResponse>({
    queryKey: ['copilot-history', opts.userId, opts.page, opts.fromDate, opts.toDate, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(opts.page),
        limit: String(limit),
      });
      if (opts.fromDate) params.set('fromDate', opts.fromDate);
      if (opts.toDate) params.set('toDate', opts.toDate);
      const res = await api.get<{ data: CopilotConversationsListResponse }>(
        `/ai/copilot/conversations?${params}`,
      );
      return res.data.data;
    },
    enabled: !!opts.userId,
    staleTime: 30_000,
  });
}
