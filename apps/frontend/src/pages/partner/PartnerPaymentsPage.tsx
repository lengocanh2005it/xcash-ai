import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Receipt, Search, Wallet } from 'lucide-react';
import { type ElementType, useCallback, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
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
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { formatVND } from '@/lib/format-vnd';
import { PLAN_LABELS } from '@/lib/plan-labels';

interface PartnerPayment {
  id: string;
  orderCode: string;
  tenantId: string;
  businessName: string;
  orderType: string;
  targetPlan: string;
  amount: number;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  paidAt: string | null;
  createdAt: string;
}

interface PaymentsResponse {
  items: PartnerPayment[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  summary: { totalCount: number; paidCount: number; totalPaid: number };
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_LABELS: Record<PartnerPayment['status'], string> = {
  paid: 'Đã thanh toán',
  pending: 'Chờ thanh toán',
  expired: 'Hết hạn',
  failed: 'Thất bại',
};

const STATUS_CLASSES: Record<PartnerPayment['status'], string> = {
  paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  expired: 'bg-muted text-muted-foreground',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  upgrade: 'Nâng cấp',
  renewal: 'Gia hạn',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
        </div>
        <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums">{value}</p>
        {hint ? (
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function PartnerPaymentsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PartnerPayment['status']>('all');
  const [planFilter, setPlanFilter] = useState<'all' | string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(
    searchInput,
    SEARCH_DEBOUNCE_MS,
    useCallback(() => {
      setPage(1);
    }, []),
  );

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: [
      'partner',
      'payments',
      { page, search: debouncedSearch, statusFilter, planFilter, fromDate, toDate },
    ],
    queryFn: () =>
      api
        .get<{ data: PaymentsResponse }>('/partner/payments', {
          params: {
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch.trim() || undefined,
            status: statusFilter,
            plan: planFilter,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          },
        })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  });

  const hasDateFilter = fromDate !== '' || toDate !== '';
  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    statusFilter !== 'all' ||
    planFilter !== 'all' ||
    hasDateFilter;
  const isSearchPending = searchInput !== debouncedSearch;
  const filterHint = hasActiveFilters ? 'Theo bộ lọc hiện tại' : undefined;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const summary = data?.summary;

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <>
      <Header
        title="Lịch sử thanh toán"
        description="Toàn bộ giao dịch thanh toán gói dịch vụ (PayOS) từ các doanh nghiệp"
        hideThemeToggle
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
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
                {isSearchPending ? (
                  <span className="absolute top-full left-0 mt-1 text-[11px] text-muted-foreground">
                    Đang tìm...
                  </span>
                ) : null}
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as typeof statusFilter);
                  setPage(1);
                }}
              >
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
              <Select
                value={planFilter}
                onValueChange={(v) => {
                  setPlanFilter(v);
                  setPage(1);
                }}
              >
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
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="sm:w-[9.5rem]"
                />
                <span className="text-sm text-muted-foreground">→</span>
                <Input
                  type="date"
                  aria-label="Đến ngày"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="sm:w-[9.5rem]"
                />
                {hasDateFilter ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFromDate('');
                      setToDate('');
                      setPage(1);
                    }}
                  >
                    Xóa lọc ngày
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={8} columns={6} />
            ) : isError ? (
              <EmptyState
                title="Không tải được dữ liệu"
                description="Đã có lỗi xảy ra khi tải lịch sử thanh toán"
                action={
                  <Button variant="outline" onClick={() => refetch()}>
                    Thử lại
                  </Button>
                }
              />
            ) : !items.length ? (
              <EmptyState
                title="Không có giao dịch nào"
                description="Thử đổi từ khóa hoặc bộ lọc khác"
              />
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {items.map((p) => (
                    <Card key={p.id} className="py-4">
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{p.businessName}</p>
                          <Badge className={STATUS_CLASSES[p.status]}>
                            {STATUS_LABELS[p.status]}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">{p.orderCode}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {PLAN_LABELS[p.targetPlan] ?? p.targetPlan}
                          </Badge>
                          <span className="text-muted-foreground">
                            {ORDER_TYPE_LABELS[p.orderType] ?? p.orderType}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-medium tabular-nums">{formatVND(p.amount)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(p.paidAt ?? p.createdAt)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Doanh nghiệp</th>
                        <th className="pb-2 pr-4 font-medium">Mã đơn</th>
                        <th className="pb-2 pr-4 font-medium">Gói</th>
                        <th className="pb-2 pr-4 font-medium">Loại</th>
                        <th className="pb-2 pr-4 text-right font-medium">Số tiền</th>
                        <th className="pb-2 pr-4 font-medium">Trạng thái</th>
                        <th className="pb-2 font-medium">Thời gian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.map((p) => (
                        <tr key={p.id} className="hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{p.businessName}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                            {p.orderCode}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary">
                              {PLAN_LABELS[p.targetPlan] ?? p.targetPlan}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {ORDER_TYPE_LABELS[p.orderType] ?? p.orderType}
                          </td>
                          <td className="py-2 pr-4 text-right font-medium tabular-nums">
                            {formatVND(p.amount)}
                          </td>
                          <td className="py-2 pr-4">
                            <Badge className={STATUS_CLASSES[p.status]}>
                              {STATUS_LABELS[p.status]}
                            </Badge>
                          </td>
                          <td className="py-2 whitespace-nowrap text-muted-foreground">
                            {formatDateTime(p.paidAt ?? p.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <p className="text-xs text-muted-foreground">
                    Hiển thị {rangeStart}–{rangeEnd} trên tổng {total} giao dịch
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1 || isFetching}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="size-4" />
                      Trước
                    </Button>
                    <span className="text-sm tabular-nums">
                      Trang {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages || isFetching}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Sau
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
