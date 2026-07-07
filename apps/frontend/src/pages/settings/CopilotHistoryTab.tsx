import { SubscriptionPlan } from '@xcash/shared-types';
import { Bot, ChevronLeft, ChevronRight, ExternalLink, MessageSquare, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CopilotQuotaSummary } from '@/components/copilot/CopilotQuotaSummary';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { useCopilotHistoryPage } from '@/hooks/useCopilotHistoryPage';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { formatDateVN } from '@/lib/dashboard-transactions';

const STORAGE_KEY_PREFIX = 'xcash_copilot_conv_';
const PAGE_LIMIT = 10;

function formatDateTimeVN(iso: string) {
  const date = new Date(iso);
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const debouncedFrom = useDebouncedValue(fromDate, 400);
  const debouncedTo = useDebouncedValue(toDate, 400);
  const hasDateFilter = Boolean(debouncedFrom || debouncedTo);

  const resetPage = useCallback(() => setPage(1), []);
  useEffect(() => {
    resetPage();
  }, [debouncedFrom, debouncedTo, resetPage]);

  const { data, isLoading, isError, refetch } = useCopilotHistoryPage({
    userId: user?.id,
    page,
    fromDate: debouncedFrom || undefined,
    toDate: debouncedTo || undefined,
    limit: PAGE_LIMIT,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const openConversation = (id: string) => {
    if (!user?.id) return;
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${user.id}`, id);
    navigate('/copilot');
  };

  const clearFilters = () => {
    setFromDate('');
    setToDate('');
  };

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
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="copilot-history-to">Đến ngày</Label>
            <Input
              id="copilot-history-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
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
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cập nhật</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead className="text-right hidden sm:table-cell">
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
                    <span className="hidden sm:inline">{formatDateTimeVN(item.updatedAt)}</span>
                    <span className="sm:hidden">{formatDateVN(item.updatedAt)}</span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium truncate max-w-[200px] sm:max-w-md">{item.title}</p>
                    {item.lastMessage && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-md">
                        {formatMessagePreview(item.lastMessage)}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell tabular-nums">
                    {item.messageCount}
                  </TableCell>
                  <TableCell>
                    <ExternalLink className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {total} kết quả
            {totalPages > 1 ? ` · Trang ${page}/${totalPages}` : null}
          </p>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          )}
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
