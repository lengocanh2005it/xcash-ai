import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bot, Building2, ChevronLeft, ChevronRight, Coins, Sparkles } from 'lucide-react';
import { type ElementType, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { SummaryCard } from '@/components/shared/SummaryCard';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { formatDateTimeShort } from '@/lib/date';
import { formatUsdCost, formatUsdWithVnd, USD_TO_VND_RATE, usdToVnd } from '@/lib/format-ai-cost';
import type {
  AiCostBreakdownItem,
  AiCostDetailResponse,
  AiCostRow,
  AiCostsResponse,
} from '@/types/partner';

const CALL_TYPE_LABELS: Record<string, string> = {
  classify: 'Định khoản',
  copilot: 'Copilot',
  embedding: 'Embedding',
  title_gen: 'Tiêu đề',
};

const CALL_TYPE_DESCRIPTIONS: Record<string, string> = {
  classify: 'Mỗi giao dịch được AI định khoản tự động (gpt-4o-mini)',
  copilot: 'Chat Copilot — có thể gồm nhiều tool call mỗi lượt',
  embedding: 'Vector hóa nội dung cho few-shot & knowledge base',
  title_gen: 'Tự sinh tiêu đề cuộc hội thoại Copilot',
};

const CALL_TYPE_ICONS: Record<string, ElementType> = {
  classify: Sparkles,
  copilot: Sparkles,
  embedding: Sparkles,
  title_gen: Sparkles,
};

const CALL_TYPE_COLORS: Record<string, string> = {
  classify: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  copilot: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  embedding: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  title_gen: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

const CALL_TYPE_ORDER = ['classify', 'copilot', 'embedding', 'title_gen'] as const;

function getDefaultFromDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('vi-VN');
}

function CallTypeCard({
  callType,
  summary,
  isLoading,
}: {
  callType: string;
  summary?: AiCostBreakdownItem;
  isLoading?: boolean;
}) {
  const Icon = CALL_TYPE_ICONS[callType] ?? Sparkles;
  const colorClass = CALL_TYPE_COLORS[callType] ?? '';

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
          >
            <Icon className="size-4" />
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-16 rounded" />
          ) : (
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">
                {formatUsdCost(summary?.costUsd ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                ~{usdToVnd(summary?.costUsd ?? 0).toLocaleString('vi-VN')}đ
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 text-sm font-medium">{CALL_TYPE_LABELS[callType] ?? callType}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {CALL_TYPE_DESCRIPTIONS[callType] ?? ''}
        </p>
        {isLoading ? (
          <Skeleton className="mt-3 h-4 w-full rounded" />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{summary?.callCount ?? 0}</span> lượt gọi
            {' · '}
            {formatTokenCount((summary?.tokensIn ?? 0) + (summary?.tokensOut ?? 0))} tokens
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PartnerAiCostsPage() {
  const [detailTenant, setDetailTenant] = useState<AiCostRow | null>(null);
  const [detailCallType, setDetailCallType] = useState<string>('all');
  const [detailPage, setDetailPage] = useState(1);

  const { data, filters, setFilter, page, setPage, isLoading } = useFilteredPagination({
    queryKey: ['partner', 'ai-costs'],
    queryFn: ({ filters, page }) =>
      api
        .get<{ data: AiCostsResponse }>('/partner/ai-costs', {
          params: {
            ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
            ...(filters.toDate ? { toDate: filters.toDate } : {}),
            page,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
    defaultFilters: { fromDate: getDefaultFromDate(), toDate: '' },
    debounceMs: 400,
    keepPrevious: true,
  });

  const hasDateFilter = filters.toDate !== '';

  const { data: detail, isLoading: loadingDetail } = useQuery<AiCostDetailResponse>({
    queryKey: ['partner', 'ai-cost-detail', detailTenant?.tenantId, detailCallType, detailPage],
    queryFn: () =>
      api
        .get<{ data: AiCostDetailResponse }>('/partner/ai-costs/detail', {
          params: {
            tenantId: detailTenant!.tenantId,
            ...(detailCallType !== 'all' ? { callType: detailCallType } : {}),
            ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
            ...(filters.toDate ? { toDate: filters.toDate } : {}),
            page: detailPage,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
    enabled: !!detailTenant,
    placeholderData: keepPreviousData,
  });

  const periodHint = useMemo(() => {
    if (hasDateFilter) return 'Trong kỳ đã chọn';
    return 'Từ đầu tháng đến hôm nay';
  }, [hasDateFilter]);

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    if (field === 'from') setFilter('fromDate', value);
    else setFilter('toDate', value);
  };

  const clearDateFilter = () => {
    setFilter('fromDate', getDefaultFromDate());
    setFilter('toDate', '');
  };

  const openDetail = (row: AiCostRow) => {
    setDetailTenant(row);
    setDetailCallType('all');
    setDetailPage(1);
  };

  const closeDetail = () => setDetailTenant(null);

  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      <Header title="Chi phí AI" description="Theo dõi chi phí OpenAI API theo từng doanh nghiệp" />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            icon={Coins}
            label="Tổng chi phí OpenAI"
            value={formatUsdCost(data?.grandTotalCostUsd ?? 0)}
            subValue={
              (data?.grandTotalCostUsd ?? 0) > 0
                ? `~${usdToVnd(data?.grandTotalCostUsd ?? 0).toLocaleString('vi-VN')}đ`
                : undefined
            }
            hint={`${periodHint} · 1 USD ≈ ${USD_TO_VND_RATE.toLocaleString('vi-VN')}đ`}
            isLoading={isLoading}
          />
          <SummaryCard
            icon={Bot}
            label="Lượt gọi API"
            value={(data?.grandTotalCalls ?? 0).toLocaleString('vi-VN')}
            hint="Tổng số request tới OpenAI trong kỳ"
            isLoading={isLoading}
          />
          <SummaryCard
            icon={Sparkles}
            label="Tổng tokens"
            value={formatTokenCount(
              (data?.grandTotalTokensIn ?? 0) + (data?.grandTotalTokensOut ?? 0),
            )}
            hint={`In: ${formatTokenCount(data?.grandTotalTokensIn ?? 0)} · Out: ${formatTokenCount(data?.grandTotalTokensOut ?? 0)}`}
            isLoading={isLoading}
          />
          <SummaryCard
            icon={Building2}
            label="Doanh nghiệp có phát sinh"
            value={String(data?.tenantCount ?? 0)}
            hint="Số DN có ít nhất 1 lượt gọi AI trong kỳ"
            isLoading={isLoading}
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-foreground">Phân loại theo loại cuộc gọi</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {CALL_TYPE_ORDER.map((callType) => (
              <CallTypeCard
                key={callType}
                callType={callType}
                summary={data?.callTypeSummary?.[callType]}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Chi phí theo doanh nghiệp</CardTitle>
            <CardDescription>
              Xếp hạng theo chi phí cao nhất · click một dòng để xem từng lượt gọi
            </CardDescription>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Từ</span>
                <Input
                  type="date"
                  value={filters.fromDate}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Đến</span>
                <Input
                  type="date"
                  value={filters.toDate}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                  className="w-40"
                />
              </div>
              {hasDateFilter ? (
                <Button variant="link" size="sm" className="h-auto px-1" onClick={clearDateFilter}>
                  Đặt lại kỳ
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton columns={5} rows={8} />
            ) : !data?.items.length ? (
              <EmptyState
                icon={Bot}
                title="Không có dữ liệu trong kỳ đã chọn"
                description="Thử đổi khoảng ngày lọc để xem chi phí AI theo doanh nghiệp."
              />
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="space-y-2 lg:hidden">
                  {data.items.map((row) => (
                    <button
                      type="button"
                      key={row.tenantId}
                      className="w-full rounded-lg border p-3 text-left space-y-1.5 hover:bg-muted/50 transition-colors"
                      onClick={() => openDetail(row)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{row.tenantName}</span>
                        <span className="text-sm font-semibold tabular-nums">
                          {formatUsdCost(row.totalCostUsd)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(row.breakdown).map(([ct, b]) => (
                          <Badge
                            key={ct}
                            variant="outline"
                            className={`text-[10px] ${CALL_TYPE_COLORS[ct] ?? ''}`}
                          >
                            {CALL_TYPE_LABELS[ct] ?? ct} ×{b.callCount}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>In: {row.totalTokensIn.toLocaleString('vi-VN')}</span>
                        <span>Ra: {row.totalTokensOut.toLocaleString('vi-VN')}</span>
                      </div>
                    </button>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Doanh nghiệp</TableHead>
                        <TableHead className="text-right">Tokens vào</TableHead>
                        <TableHead className="text-right">Tokens ra</TableHead>
                        <TableHead>Loại cuộc gọi</TableHead>
                        <TableHead className="text-right">Chi phí (USD)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((row) => (
                        <TableRow
                          key={row.tenantId}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openDetail(row)}
                        >
                          <TableCell className="font-medium">{row.tenantName}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                            {row.totalTokensIn.toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                            {row.totalTokensOut.toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(row.breakdown).map(([ct, b]) => (
                                <Badge
                                  key={ct}
                                  variant="outline"
                                  className={`text-[11px] ${CALL_TYPE_COLORS[ct] ?? ''}`}
                                >
                                  {CALL_TYPE_LABELS[ct] ?? ct} ×{b.callCount}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            <div>{formatUsdCost(row.totalCostUsd)}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              ~{usdToVnd(row.totalCostUsd).toLocaleString('vi-VN')}đ
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 ? (
                  <div className="mt-4 border-t pt-4">
                    <PaginationBar
                      page={page}
                      totalPages={totalPages}
                      total={data?.total}
                      label="{total} doanh nghiệp"
                      onPageChange={(p) => setPage(p)}
                    />
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!detailTenant} onOpenChange={(open) => !open && closeDetail()}>
        <SheetContent className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <SheetHeader className="shrink-0 border-b px-6 py-4">
            <SheetTitle className="text-base">{detailTenant?.tenantName}</SheetTitle>
            <p className="text-xs text-muted-foreground">
              Chi tiết cuộc gọi AI · {formatUsdWithVnd(detailTenant?.totalCostUsd ?? 0)} tổng
            </p>
            <div className="mt-3">
              <Select
                value={detailCallType}
                onValueChange={(v) => {
                  setDetailCallType(v);
                  setDetailPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  {Object.entries(CALL_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-auto [&_[data-slot=table-container]]:overflow-visible">
            {loadingDetail ? (
              <div className="p-4">
                <TableSkeleton columns={7} rows={10} />
              </div>
            ) : !detail?.items.length ? (
              <div className="p-4">
                <EmptyState
                  icon={Bot}
                  title="Không có dữ liệu"
                  description="Không có cuộc gọi AI nào cho bộ lọc này."
                />
              </div>
            ) : (
              <>
                {/* Mobile card layout */}
                <div className="space-y-2 p-4 lg:hidden">
                  {detail.items.map((log) => (
                    <div key={log.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${CALL_TYPE_COLORS[log.callType] ?? ''}`}
                        >
                          {CALL_TYPE_LABELS[log.callType] ?? log.callType}
                        </Badge>
                        <span className="text-xs font-medium tabular-nums">
                          {formatUsdCost(log.costUsd)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{log.model}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>In: {log.tokensIn.toLocaleString('vi-VN')}</span>
                        <span>Ra: {log.tokensOut.toLocaleString('vi-VN')}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">
                          {log.transactionId
                            ? `txn:${log.transactionId.slice(0, 8)}…`
                            : log.conversationId
                              ? `conv:${log.conversationId.slice(0, 8)}…`
                              : '—'}
                        </span>
                        <span>{formatDateTimeShort(log.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden p-4 lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loại</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">In</TableHead>
                        <TableHead className="text-right">Out</TableHead>
                        <TableHead className="text-right">Chi phí</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead>Thời gian</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[11px] ${CALL_TYPE_COLORS[log.callType] ?? ''}`}
                            >
                              {CALL_TYPE_LABELS[log.callType] ?? log.callType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {log.model}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {log.tokensIn.toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums">
                            {log.tokensOut.toLocaleString('vi-VN')}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium tabular-nums">
                            <div>{formatUsdCost(log.costUsd)}</div>
                            <div className="font-normal text-muted-foreground">
                              ~{usdToVnd(log.costUsd).toLocaleString('vi-VN')}đ
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[140px] text-xs text-muted-foreground">
                            {log.transactionId ? (
                              <span title={log.transactionId}>
                                txn:{log.transactionId.slice(0, 8)}…
                              </span>
                            ) : log.conversationId ? (
                              <span title={log.conversationId}>
                                conv:{log.conversationId.slice(0, 8)}…
                              </span>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTimeShort(log.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          {(detail?.totalPages ?? 0) > 1 ? (
            <div className="flex shrink-0 items-center justify-end gap-2 border-t px-6 py-3">
              <span className="text-sm text-muted-foreground">
                Trang {detailPage} / {detail!.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                disabled={detailPage <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setDetailPage((p) => Math.min(detail!.totalPages, p + 1))}
                disabled={detailPage >= detail!.totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
