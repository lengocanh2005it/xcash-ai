import { Bot, Building2, Coins, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { PaginatedListView } from '@/components/shared/PaginatedListView';
import { SummaryCard } from '@/components/shared/SummaryCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { formatUsdCost, USD_TO_VND_RATE, usdToVnd } from '@/lib/format-ai-cost';
import type { AiCostBreakdownItem, AiCostRow, AiCostsResponse } from '@/types/partner';
import {
  CALL_TYPE_COLORS,
  CALL_TYPE_DESCRIPTIONS,
  CALL_TYPE_ICONS,
  CALL_TYPE_LABELS,
  CALL_TYPE_ORDER,
  formatTokenCount,
  getDefaultFromDate,
} from './AiCostConstants';
import { AiCostDetailSheet } from './AiCostDetailSheet';

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

  const { data, filters, setFilter, page, setPage, isLoading, isError, refetch } =
    useFilteredPagination({
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
  };

  const closeDetail = () => setDetailTenant(null);

  const totalPages = data?.totalPages ?? 1;
  const items = data?.items ?? [];

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
            <PaginatedListView<AiCostRow>
              items={items}
              isLoading={isLoading}
              isError={isError}
              error={null}
              refetch={() => refetch()}
              skeletonRows={8}
              skeletonColumns={5}
              emptyTitle="Không có dữ liệu trong kỳ đã chọn"
              emptyDescription="Thử đổi khoảng ngày lọc để xem chi phí AI theo doanh nghiệp."
              renderMobileItem={(row) => (
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
              )}
              renderDesktopHeader={() => (
                <tr>
                  <th className="pb-2 pl-4 font-medium">Doanh nghiệp</th>
                  <th className="pb-2 font-medium text-right">Tokens vào</th>
                  <th className="pb-2 font-medium text-right">Tokens ra</th>
                  <th className="pb-2 font-medium">Loại cuộc gọi</th>
                  <th className="pb-2 pr-4 font-medium text-right">Chi phí (USD)</th>
                </tr>
              )}
              renderDesktopRow={(row) => (
                <tr
                  key={row.tenantId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(row)}
                >
                  <td className="py-2 pl-4 font-medium">{row.tenantName}</td>
                  <td className="py-2 text-right text-sm text-muted-foreground tabular-nums">
                    {row.totalTokensIn.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-2 text-right text-sm text-muted-foreground tabular-nums">
                    {row.totalTokensOut.toLocaleString('vi-VN')}
                  </td>
                  <td className="py-2">
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
                  </td>
                  <td className="py-2 pr-4 text-right font-semibold tabular-nums">
                    <div>{formatUsdCost(row.totalCostUsd)}</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      ~{usdToVnd(row.totalCostUsd).toLocaleString('vi-VN')}đ
                    </div>
                  </td>
                </tr>
              )}
              pagination={
                totalPages > 1
                  ? {
                      page,
                      totalPages,
                      total: data?.total ?? 0,
                      label: '{total} doanh nghiệp',
                      onPageChange: setPage,
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </div>

      <AiCostDetailSheet detailTenant={detailTenant} onClose={closeDetail} filters={filters} />
    </>
  );
}
