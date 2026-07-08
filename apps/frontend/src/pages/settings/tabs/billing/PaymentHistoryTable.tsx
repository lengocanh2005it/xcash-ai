import type { SubscriptionPlan } from '@xcash/shared-types';
import { Search } from 'lucide-react';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/date';
import { formatVND } from '@/lib/format-vnd';
import { PLAN_LABEL } from '@/lib/plan';
import type { PaymentHistoryResponse } from '@/types/api/billing';

const LIMIT = 10;

const ORDER_TYPE_LABEL: Record<string, string> = {
  upgrade: 'Nâng cấp gói',
  overage: 'Vượt quota',
};

export function PaymentHistoryTable() {
  const { data, filters, setFilter, resetFilters, setPage, isLoading } = useFilteredPagination({
    queryKey: ['billing', 'payment-history'],
    queryFn: ({ filters, page }) => {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (filters.orderType !== 'all') params.set('orderType', filters.orderType);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);
      return api
        .get<{ data: PaymentHistoryResponse }>(`/billing/payment-history?${params.toString()}`)
        .then((r) => r.data.data);
    },
    defaultFilters: { orderType: 'all', status: 'all', fromDate: '', toDate: '' },
    debounceMs: 400,
    keepPrevious: true,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const hasActiveFilter =
    filters.orderType !== 'all' ||
    filters.status !== 'all' ||
    Boolean(filters.fromDate) ||
    Boolean(filters.toDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lịch sử thanh toán</CardTitle>
        <CardDescription>
          Toàn bộ giao dịch thanh toán gói dịch vụ và phí vượt quota
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Select value={filters.orderType} onValueChange={(v) => setFilter('orderType', v)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Loại giao dịch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              <SelectItem value="upgrade">Nâng cấp gói</SelectItem>
              <SelectItem value="overage">Vượt quota</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="pending">Chờ thanh toán</SelectItem>
              <SelectItem value="paid">Đã thanh toán</SelectItem>
              <SelectItem value="failed">Thất bại</SelectItem>
              <SelectItem value="expired">Hết hạn</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilter('fromDate', e.target.value)}
              className="h-8 w-36 text-xs"
              placeholder="Từ ngày"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilter('toDate', e.target.value)}
              className="h-8 w-36 text-xs"
              placeholder="Đến ngày"
            />
          </div>

          {hasActiveFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => resetFilters()}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Search className="size-8 opacity-30" />
            <p className="text-sm">Không có giao dịch nào</p>
          </div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="space-y-2 lg:hidden">
              {orders.map((o) => (
                <div key={o.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{o.orderCode}</span>
                    <PaymentStatusBadge status={o.status} />
                  </div>
                  <p className="text-sm font-medium">
                    {ORDER_TYPE_LABEL[o.orderType] ?? o.orderType}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {PLAN_LABEL[o.targetPlan as SubscriptionPlan] ?? o.targetPlan}
                    </Badge>
                    <span className="font-medium">{formatVND(o.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateVN(o.createdAt)}</span>
                    <span>{o.paidAt ? formatDateVN(o.paidAt) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-md border lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Mã đơn</th>
                    <th className="px-4 py-2.5 text-left font-medium">Loại</th>
                    <th className="px-4 py-2.5 text-left font-medium">Gói</th>
                    <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                    <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                    <th className="px-4 py-2.5 text-left font-medium">Ngày tạo</th>
                    <th className="px-4 py-2.5 text-left font-medium">Ngày thanh toán</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {o.orderCode}
                      </td>
                      <td className="px-4 py-3">{ORDER_TYPE_LABEL[o.orderType] ?? o.orderType}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs uppercase">
                          {PLAN_LABEL[o.targetPlan as SubscriptionPlan] ?? o.targetPlan}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{formatVND(o.amount)}</td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateVN(o.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {o.paidAt ? formatDateVN(o.paidAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="pt-1">
            <PaginationBar
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              compact
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
