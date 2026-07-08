import type { CopilotConversationsListResponse } from '@xcash/shared-types';
import { SubscriptionPlan } from '@xcash/shared-types';
import { Bot, ExternalLink, MessageSquare, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CopilotQuotaSummary } from '@/components/copilot/CopilotQuotaSummary';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { PlanGate } from '@/components/shared/PlanGate';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function CopilotHistoryTable() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const openConversation = (id: string) => {
    if (!user?.id) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, id);
    navigate('/copilot');
  };

  const clearFilters = () => resetFilters();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CopilotQuotaSummary variant="card" />
        <TableSkeleton rows={6} columns={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <CopilotQuotaSummary variant="card" />
        <EmptyState
          icon={MessageSquare}
          title="Không tải được lịch sử"
          description="Vui lòng thử lại sau."
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Thử lại
            </Button>
          }
        />
      </div>
    );
  }

  if (!hasDateFilter && total === 0) {
    return (
      <div className="space-y-4">
        <CopilotQuotaSummary variant="card" />
        <EmptyState
          icon={Bot}
          title="Chưa có cuộc chat nào"
          description="Bắt đầu trò chuyện với AI Copilot để xem lịch sử tại đây."
          action={
            <Button size="sm" onClick={() => navigate('/copilot')}>
              Mở AI Copilot
            </Button>
          }
        />
      </div>
    );
  }

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

      {hasDateFilter && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Không có cuộc chat nào trong khoảng thời gian đã chọn.
        </p>
      )}

      {items.length > 0 && (
        <>
          {/* Mobile card layout */}
          <div className="space-y-3 lg:hidden">
            {items.map((item) => (
              <Card
                key={item.id}
                className="cursor-pointer py-4 hover:bg-muted/50 transition-colors"
                onClick={() => openConversation(item.id)}
              >
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{item.title}</p>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
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
                    <span className="text-xs text-muted-foreground">
                      {item.messageCount} tin nhắn
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cập nhật</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead className="text-right">
                    <span className="block">Tin nhắn</span>
                    <span className="block text-[10px] font-normal normal-case text-muted-foreground">
                      Bạn + AI
                    </span>
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openConversation(item.id)}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatTransactionDateTime(item.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium truncate max-w-md">{item.title}</p>
                      {item.lastMessage && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-md">
                          {formatMessagePreview(item.lastMessage)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.messageCount}</TableCell>
                    <TableCell>
                      <ExternalLink className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">{total} kết quả</p>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            compact
            onPageChange={(p) => setPage(p)}
          />
        </div>
      )}
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
