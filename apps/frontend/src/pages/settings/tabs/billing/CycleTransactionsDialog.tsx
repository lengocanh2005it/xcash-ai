import { Search } from 'lucide-react';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { TransactionSourceBadge } from '@/components/shared/TransactionSourceBadge';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/date';
import { formatVND } from '@/lib/format-vnd';
import { cn } from '@/lib/utils';
import type { CycleTransaction } from '@/types/api/billing';

interface CycleTransactionsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cycleStart: string;
  cycleEnd: string;
}

const LIMIT = 15;

export function CycleTransactionsDialog({
  open,
  onOpenChange,
  cycleStart,
  cycleEnd,
}: CycleTransactionsDialogProps) {
  const { data, filters, setFilter, resetFilters, page, setPage, isLoading } =
    useFilteredPagination({
      queryKey: ['billing', 'cycle-transactions'],
      queryFn: ({ filters, page }) => {
        const effectiveFrom = filters.fromDate
          ? new Date(
              Math.max(new Date(filters.fromDate).getTime(), new Date(cycleStart).getTime()),
            ).toISOString()
          : cycleStart;
        const effectiveTo = filters.toDate
          ? new Date(
              Math.min(
                new Date(`${filters.toDate}T23:59:59Z`).getTime(),
                new Date(cycleEnd).getTime(),
              ),
            ).toISOString()
          : cycleEnd;
        const params = new URLSearchParams({
          cycleStart: effectiveFrom,
          cycleEnd: effectiveTo,
          limit: String(LIMIT),
          page: String(page),
        });
        if (filters.search) params.set('search', filters.search);
        return api
          .get<{ data: { items: CycleTransaction[]; total: number; page: number; limit: number } }>(
            `/billing/cycle-transactions?${params.toString()}`,
          )
          .then((r) => r.data.data);
      },
      defaultFilters: { search: '', fromDate: '', toDate: '' },
      debounceMs: 400,
      enabled: open,
      keepPrevious: true,
    });

  const hasFilter = filters.search || filters.fromDate || filters.toDate;
  const items = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Giao dịch trong chu kỳ hiện tại</DialogTitle>
          <DialogDescription>
            {formatDateVN(cycleStart)} — {formatDateVN(cycleEnd)} · Giao dịch đã tính quota
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo nội dung, số tài khoản..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={filters.fromDate}
              min={cycleStart.slice(0, 10)}
              max={filters.toDate || cycleEnd.slice(0, 10)}
              onChange={(e) => setFilter('fromDate', e.target.value)}
              className="h-9 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={filters.toDate}
              min={filters.fromDate || cycleStart.slice(0, 10)}
              max={cycleEnd.slice(0, 10)}
              onChange={(e) => setFilter('toDate', e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
          {hasFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs text-muted-foreground px-2"
              onClick={() => resetFilters()}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-auto rounded-md border min-h-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Search className="size-8 opacity-30" />
              <p className="text-sm">Không tìm thấy giao dịch nào</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Ngày</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nội dung</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nguồn</th>
                  <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2.5 text-left font-medium">Định khoản</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateVN(tx.transactionDate)}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="truncate text-xs">{tx.content || '—'}</p>
                      {tx.senderAccount && (
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {tx.senderAccount}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TransactionSourceBadge source={tx.source} size="md" />
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-medium text-sm whitespace-nowrap',
                        tx.amount >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {formatVND(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {tx.classification
                        ? `Nợ ${tx.classification.debitAccount ?? '?'} / Có ${tx.classification.creditAccount ?? '?'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {tx.classification ? (
                        <TransactionStatusBadge status={tx.classification.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa định khoản</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="border-t pt-1">
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={data?.total ?? 0}
              compact
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
