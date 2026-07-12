import type { CopilotConversationsListResponse } from '@xcash/shared-types';
import { SubscriptionPlan } from '@xcash/shared-types';
import axios from 'axios';
import { ExternalLink, Loader2, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CopilotQuotaSummary } from '@/components/copilot/CopilotQuotaSummary';
import { PaginatedListView } from '@/components/shared/PaginatedListView';
import { PlanGate } from '@/components/shared/PlanGate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { formatDateVN, formatTransactionDateTime } from '@/lib/date';

const STORAGE_KEY_PREFIX = 'xcash_copilot_conv_';
const PAGE_LIMIT = 10;

const PREVIEW_MAX_LENGTH = 100;

/** Plain-text preview for conversation list — strips markdown and truncates with ellipsis. */
function formatMessagePreview(text: string) {
  const plain = text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= PREVIEW_MAX_LENGTH) return plain;

  const slice = plain.slice(0, PREVIEW_MAX_LENGTH).trimEnd();
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed =
    lastSpace > PREVIEW_MAX_LENGTH * 0.6 ? slice.slice(0, lastSpace) : slice.replace(/\s+\S*$/, '');
  return `${trimmed}...`;
}

interface ConversationItem {
  id: string;
  title: string;
  lastMessage?: string;
  messageCount: number;
  updatedAt: string;
}

function CopilotHistoryTable() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [openingId, setOpeningId] = useState<string | null>(null);

  const { data, filters, setFilter, resetFilters, page, setPage, isLoading, isError, refetch } =
    useFilteredPagination({
      queryKey: ['copilot-history', user?.id],
      queryFn: ({ filters, page }) => {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
        if (filters.fromDate) params.set('fromDate', filters.fromDate);
        if (filters.toDate) params.set('toDate', filters.toDate);
        return api
          .get<{ data: CopilotConversationsListResponse }>(`/ai/copilot/conversations?${params}`)
          .then((r) => r.data.data);
      },
      defaultFilters: { fromDate: '', toDate: '' },
      debounceMs: 400,
      enabled: !!user?.id,
    });

  const hasDateFilter = Boolean(filters.fromDate || filters.toDate);
  const items = (data?.items ?? []) as ConversationItem[];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const openConversation = async (id: string) => {
    if (!user?.id || openingId) return;
    setOpeningId(id);
    try {
      await api.get(`/ai/copilot/conversations/${id}`);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, id);
      navigate('/copilot');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        toast.error('Cuộc trò chuyện không còn tồn tại hoặc đã bị xóa.');
        void refetch();
      } else {
        toast.error('Không mở được cuộc trò chuyện, vui lòng thử lại.');
      }
    } finally {
      setOpeningId(null);
    }
  };

  const clearFilters = () => resetFilters();

  return (
    <div className="space-y-4">
      <CopilotQuotaSummary variant="card" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="copilot-history-from">Từ ngày</Label>
            <Input
              id="copilot-history-from"
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilter('fromDate', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copilot-history-to">Đến ngày</Label>
            <Input
              id="copilot-history-to"
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilter('toDate', e.target.value)}
            />
          </div>
        </div>
        {hasDateFilter && (
          <Button variant="ghost" size="sm" className="gap-1.5 self-start" onClick={clearFilters}>
            <X className="size-3.5" />
            Xóa bộ lọc
          </Button>
        )}
      </div>

      {hasDateFilter && items.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">
          Không có cuộc chat nào trong khoảng thời gian đã chọn.
        </p>
      )}

      <PaginatedListView<ConversationItem>
        items={items}
        isLoading={isLoading}
        isError={isError}
        error={null}
        refetch={() => refetch()}
        skeletonRows={6}
        skeletonColumns={4}
        emptyTitle="Chưa có cuộc chat nào"
        emptyDescription="Bắt đầu trò chuyện với AI Copilot để xem lịch sử tại đây."
        renderMobileItem={(item) => (
          <Card
            key={item.id}
            aria-busy={openingId === item.id}
            className="cursor-pointer py-4 hover:bg-muted/50 transition-colors aria-busy:pointer-events-none aria-busy:opacity-60"
            onClick={() => openConversation(item.id)}
          >
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium truncate">{item.title}</p>
                {openingId === item.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                )}
              </div>
              {item.lastMessage && (
                <p className="text-xs text-muted-foreground truncate">
                  {formatMessagePreview(item.lastMessage)}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatDateVN(item.updatedAt)}
                </span>
                <span className="text-xs text-muted-foreground">{item.messageCount} tin nhắn</span>
              </div>
            </CardContent>
          </Card>
        )}
        renderDesktopHeader={() => (
          <tr>
            <th className="pb-2 pl-4 font-medium">Cập nhật</th>
            <th className="pb-2 font-medium">Tiêu đề</th>
            <th className="pb-2 font-medium text-right">
              <span className="block">Tin nhắn</span>
              <span className="block text-[10px] font-normal normal-case text-muted-foreground">
                Bạn + AI
              </span>
            </th>
            <th className="pb-2 pr-4 w-10" />
          </tr>
        )}
        renderDesktopRow={(item) => (
          <tr
            key={item.id}
            aria-busy={openingId === item.id}
            className="cursor-pointer hover:bg-muted/50 aria-busy:pointer-events-none aria-busy:opacity-60"
            onClick={() => openConversation(item.id)}
          >
            <td className="py-2 pl-4 whitespace-nowrap text-muted-foreground">
              {formatTransactionDateTime(item.updatedAt)}
            </td>
            <td className="py-2">
              <p className="font-medium truncate max-w-md">{item.title}</p>
              {item.lastMessage && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-md">
                  {formatMessagePreview(item.lastMessage)}
                </p>
              )}
            </td>
            <td className="py-2 text-right tabular-nums">{item.messageCount}</td>
            <td className="py-2 pr-4">
              {openingId === item.id ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <ExternalLink className="size-4 text-muted-foreground" />
              )}
            </td>
          </tr>
        )}
        pagination={{
          page,
          totalPages,
          total,
          label: '{total} kết quả',
          compact: true,
          onPageChange: setPage,
        }}
      />
    </div>
  );
}

export function CopilotHistoryTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="size-4" />
          Lịch sử Copilot
        </CardTitle>
        <CardDescription>
          Danh sách cuộc trò chuyện AI Copilot của bạn. Nhấn vào một dòng để mở lại trong AI
          Copilot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PlanGate minPlan={SubscriptionPlan.STARTER} featureName="Lịch sử Copilot">
          <CopilotHistoryTable />
        </PlanGate>
      </CardContent>
    </Card>
  );
}
