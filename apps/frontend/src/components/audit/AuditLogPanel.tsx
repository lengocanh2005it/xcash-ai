import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AuditLogDetailSheet } from '@/components/audit/AuditLogDetailSheet';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/date';

export interface AuditLogItem {
  id: string;
  tenantId: string | null;
  businessName: string | null;
  entityType: string;
  entityTypeLabel: string;
  entityId: string;
  action: string;
  actionLabel: string;
  actor: string;
  actorLabel: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditLogsResponse {
  items: AuditLogItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const ACTION_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả hành động' },
  { value: 'review_confirmed', label: 'Xác nhận định khoản' },
  { value: 'review_corrected', label: 'Sửa định khoản' },
  { value: 'review_skipped', label: 'Bỏ qua review' },
  { value: 'ai_auto_classify', label: 'AI tự động định khoản' },
  { value: 'ai_queued_review', label: 'AI đưa vào hàng chờ review' },
  { value: 'banking_linked', label: 'Liên kết ngân hàng' },
  { value: 'tenant_registered', label: 'Đăng ký doanh nghiệp' },
  { value: 'subscription_upgraded', label: 'Nâng cấp gói' },
  { value: 'overage_paid', label: 'Thanh toán phí vượt quota' },
  { value: 'tenant_suspended', label: 'Khóa doanh nghiệp' },
  { value: 'tenant_activated', label: 'Mở khóa doanh nghiệp' },
  { value: 'partner_set_plan', label: 'Partner đặt gói' },
  { value: 'plan_pricing_updated', label: 'Cập nhật giá gói' },
];

const ENTITY_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả đối tượng' },
  { value: 'transaction_classification', label: 'Định khoản' },
  { value: 'transaction', label: 'Giao dịch' },
  { value: 'tenant', label: 'Doanh nghiệp' },
  { value: 'cas_grant', label: 'Liên kết ngân hàng' },
  { value: 'subscription', label: 'Gói dịch vụ' },
  { value: 'payment_order', label: 'Thanh toán' },
  { value: 'plan_pricing', label: 'Bảng giá gói' },
];

interface AuditLogPanelProps {
  endpoint: string;
  showTenant?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function AuditLogPanel({
  endpoint,
  showTenant = false,
  emptyTitle = 'Chưa có nhật ký',
  emptyDescription = 'Các thao tác trong hệ thống sẽ được ghi lại tại đây.',
}: AuditLogPanelProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(
    searchInput,
    SEARCH_DEBOUNCE_MS,
    useCallback(() => setPage(1), []),
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'audit-logs',
      endpoint,
      page,
      debouncedSearch,
      actionFilter,
      entityTypeFilter,
      fromDate,
      toDate,
    ],
    queryFn: () =>
      api
        .get<{ data: AuditLogsResponse }>(endpoint, {
          params: {
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch.trim() || undefined,
            action: actionFilter !== 'all' ? actionFilter : undefined,
            entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          },
        })
        .then((response) => response.data.data),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isSearchPending = searchInput !== debouncedSearch;

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    actionFilter !== 'all' ||
    entityTypeFilter !== 'all' ||
    fromDate !== '' ||
    toDate !== '';

  const clearFilters = () => {
    setSearchInput('');
    setActionFilter('all');
    setEntityTypeFilter('all');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const openDetail = (item: AuditLogItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={
              showTenant
                ? 'Tìm theo người thực hiện, doanh nghiệp, mã đối tượng...'
                : 'Tìm theo người thực hiện, mã đối tượng...'
            }
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Hành động</Label>
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setActionFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_FILTER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Đối tượng</Label>
            <Select
              value={entityTypeFilter}
              onValueChange={(value) => {
                setEntityTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Từ ngày</Label>
            <Input
              type="date"
              className="w-[150px]"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Đến ngày</Label>
            <Input
              type="date"
              className="w-[150px]"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
              }}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearFilters}>
              <X className="size-4" />
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {(isFetching && !isLoading) || isSearchPending ? (
          <span className="text-xs text-muted-foreground">Đang tải...</span>
        ) : null}
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={showTenant ? 6 : 5} />
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="space-y-2 lg:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDateVN(item.createdAt)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 text-xs text-muted-foreground"
                    onClick={() => openDetail(item)}
                  >
                    <Eye className="size-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {item.actionLabel}
                  </Badge>
                  <span className="text-sm font-medium">{item.actorLabel}</span>
                </div>
                {showTenant && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.businessName ?? '—'}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {item.entityTypeLabel}
                  <span className="ml-1 font-mono">{item.entityId.slice(0, 12)}…</span>
                </p>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2 font-medium">Thời gian</th>
                  {showTenant && <th className="px-3 py-2 font-medium">Doanh nghiệp</th>}
                  <th className="px-3 py-2 font-medium">Người thực hiện</th>
                  <th className="px-3 py-2 font-medium">Hành động</th>
                  <th className="px-3 py-2 font-medium">Đối tượng</th>
                  <th className="px-3 py-2 font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b last:border-0 align-middle hover:bg-muted/20"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDateVN(item.createdAt)}
                    </td>
                    {showTenant && (
                      <td className="px-3 py-2.5 max-w-[160px] truncate">
                        {item.businessName ?? '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5">{item.actorLabel}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant="secondary">{item.actionLabel}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div>{item.entityTypeLabel}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate max-w-[140px]">
                        {item.entityId}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        onClick={() => openDetail(item)}
                      >
                        <Eye className="size-4" />
                        <span className="hidden sm:inline">Chi tiết</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && total > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Trang {page}/{totalPages} · {total} bản ghi
            {hasActiveFilters ? ' (đã lọc)' : ''}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" />
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            >
              Sau
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <AuditLogDetailSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        showTenant={showTenant}
      />
    </div>
  );
}
