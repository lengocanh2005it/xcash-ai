import { Receipt, Search, Wallet } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PaginatedListView } from '@/components/shared/PaginatedListView';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
import { SummaryCard } from '@/components/shared/SummaryCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { formatTransactionDateTime } from '@/lib/date';
import { formatVND } from '@/lib/format-vnd';
import { PLAN_LABELS } from '@/lib/plans';
import type { PartnerPayment, PaymentsResponse } from '@/types/partner';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const ORDER_TYPE_LABELS: Record<string, string> = {
  upgrade: 'Nâng cấp',
  renewal: 'Gia hạn',
};

export default function PartnerPaymentsPage() {
  const {
    data,
    filters,
    debouncedFilters,
    setFilter,
    page,
    setPage,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useFilteredPagination({
    queryKey: ['partner', 'payments'],
    queryFn: ({ filters, page }) =>
      api
        .get<{ data: PaymentsResponse }>('/partner/payments', {
          params: {
            page,
            limit: PAGE_SIZE,
            search: filters.search.trim() || undefined,
            status: filters.status,
            plan: filters.plan,
            fromDate: filters.fromDate || undefined,
            toDate: filters.toDate || undefined,
          },
        })
        .then((r) => r.data.data),
    defaultFilters: { search: '', status: 'all', plan: 'all', fromDate: '', toDate: '' },
    debounceMs: SEARCH_DEBOUNCE_MS,
    keepPrevious: true,
  });

  const hasDateFilter = filters.fromDate !== '' || filters.toDate !== '';
  const hasActiveFilters =
    debouncedFilters.search.trim() !== '' ||
    debouncedFilters.status !== 'all' ||
    debouncedFilters.plan !== 'all' ||
    hasDateFilter;
  const isSearchPending = filters.search !== debouncedFilters.search;
  const filterHint = hasActiveFilters ? 'Theo bộ lọc hiện tại' : undefined;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const summary = data?.summary;

  return (
    <>
      <Header
        title="Lịch sử thanh toán"
        description="Toàn bộ giao dịch thanh toán gói dịch vụ (PayOS) từ các doanh nghiệp"
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            icon={Wallet}
            label="Tổng đã thu"
            value={summary ? formatVND(summary.totalPaid) : '—'}
            hint={filterHint ?? 'Tổng tiền các đơn ở trạng thái đã thanh toán (toàn hệ thống)'}
          />
          <SummaryCard
            icon={Receipt}
            label="Đơn thành công"
            value={summary ? String(summary.paidCount) : '—'}
            hint={filterHint ?? 'Số đơn đã thanh toán thành công (toàn hệ thống)'}
          />
          <SummaryCard
            icon={Receipt}
            label="Tổng số đơn"
            value={summary ? String(summary.totalCount) : '—'}
            hint={
              filterHint ??
              'Bao gồm mọi trạng thái (đã thu, chờ, hết hạn, thất bại) — toàn hệ thống'
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách giao dịch</CardTitle>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo doanh nghiệp hoặc mã đơn..."
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  className="pl-8"
                />
                {isSearchPending ? (
                  <span className="absolute top-full left-0 mt-1 text-[11px] text-muted-foreground">
                    Đang tìm...
                  </span>
                ) : null}
              </div>
              <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="paid">Đã thanh toán</SelectItem>
                  <SelectItem value="pending">Chờ thanh toán</SelectItem>
                  <SelectItem value="expired">Hết hạn</SelectItem>
                  <SelectItem value="failed">Thất bại</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.plan} onValueChange={(v) => setFilter('plan', v)}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Gói" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả gói</SelectItem>
                  {Object.entries(PLAN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  aria-label="Từ ngày"
                  value={filters.fromDate}
                  max={filters.toDate || undefined}
                  onChange={(e) => setFilter('fromDate', e.target.value)}
                  className="sm:w-[9.5rem]"
                />
                <span className="text-sm text-muted-foreground">→</span>
                <Input
                  type="date"
                  aria-label="Đến ngày"
                  value={filters.toDate}
                  min={filters.fromDate || undefined}
                  onChange={(e) => setFilter('toDate', e.target.value)}
                  className="sm:w-[9.5rem]"
                />
                {hasDateFilter ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilter('fromDate', '');
                      setFilter('toDate', '');
                    }}
                  >
                    Xóa lọc ngày
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <PaginatedListView<PartnerPayment>
              items={items}
              isLoading={isLoading}
              isError={isError}
              error={null}
              refetch={() => refetch()}
              skeletonRows={8}
              skeletonColumns={6}
              emptyTitle="Không có giao dịch nào"
              emptyDescription="Thử đổi từ khóa hoặc bộ lọc khác"
              hasActiveFilters={hasActiveFilters}
              renderMobileItem={(p) => (
                <Card key={p.id} className="py-4">
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{p.businessName}</p>
                      <PaymentStatusBadge status={p.status} />
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{p.orderCode}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{PLAN_LABELS[p.targetPlan] ?? p.targetPlan}</Badge>
                      <span className="text-muted-foreground">
                        {ORDER_TYPE_LABELS[p.orderType] ?? p.orderType}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium tabular-nums">{formatVND(p.amount)}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatTransactionDateTime(p.paidAt ?? p.createdAt)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
              renderDesktopHeader={() => (
                <tr>
                  <th className="pb-2 pl-4 font-medium">Doanh nghiệp</th>
                  <th className="pb-2 font-medium">Mã đơn</th>
                  <th className="pb-2 font-medium">Gói</th>
                  <th className="pb-2 font-medium">Loại</th>
                  <th className="pb-2 font-medium text-right">Số tiền</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 pr-4 font-medium">Thời gian</th>
                </tr>
              )}
              renderDesktopRow={(p) => (
                <tr key={p.id}>
                  <td className="py-2 pl-4 font-medium">{p.businessName}</td>
                  <td className="py-2 font-mono text-xs text-muted-foreground">{p.orderCode}</td>
                  <td className="py-2">
                    <Badge variant="secondary">{PLAN_LABELS[p.targetPlan] ?? p.targetPlan}</Badge>
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {ORDER_TYPE_LABELS[p.orderType] ?? p.orderType}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatVND(p.amount)}
                  </td>
                  <td className="py-2">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                    {formatTransactionDateTime(p.paidAt ?? p.createdAt)}
                  </td>
                </tr>
              )}
              pagination={{
                page,
                totalPages,
                total,
                label: 'Hiển thị {total} giao dịch',
                isFetching,
                onPageChange: setPage,
              }}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
