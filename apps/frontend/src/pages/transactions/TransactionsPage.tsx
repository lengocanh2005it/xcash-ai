import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Role } from '@xcash/shared-types';
import { FileSpreadsheet, Loader2, Receipt, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { SignedTransactionAmount } from '@/components/shared/SignedTransactionAmount';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { TransactionSourceBadge } from '@/components/shared/TransactionSourceBadge';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useTransactionEvents } from '@/hooks/useTransactionEvents';
import { getApiData, postApiData } from '@/lib/api';
import { formatTransactionTime } from '@/lib/dashboard-transactions';
import { getErrorMessage } from '@/lib/errors';
import type { TransactionListResponse, TransactionSummary } from '@/types/transaction';
import { ImportTransactionsDialog } from './ImportTransactionsDialog';
import { TransactionDetailSheet } from './TransactionDetailSheet';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'classified', label: 'Đã định khoản' },
  { value: 'review', label: 'Cần review' },
  { value: 'skipped', label: 'Bỏ qua' },
];

const SOURCE_OPTIONS = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'cas', label: 'Ngân hàng' },
  { value: 'import', label: 'Import Excel' },
];

function buildTransactionsUrl(params: {
  page: number;
  status: string;
  source: string;
  fromDate: string;
  toDate: string;
  search: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });

  if (params.status) {
    search.set('status', params.status);
  }
  if (params.source) {
    search.set('source', params.source);
  }
  if (params.fromDate) {
    search.set('from_date', new Date(params.fromDate).toISOString());
  }
  if (params.toDate) {
    const end = new Date(params.toDate);
    end.setHours(23, 59, 59, 999);
    search.set('to_date', end.toISOString());
  }
  if (params.search.trim()) {
    search.set('search', params.search.trim());
  }

  return `/transactions?${search.toString()}`;
}

interface BulkReclassifyResult {
  queued: number;
  skipped: number;
}

function isPendingTransaction(status: string) {
  return status === 'pending';
}

export default function TransactionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  useTransactionEvents();
  const canBulkReclassify = user?.role === Role.ADMIN || user?.role === Role.ACCOUNTANT;
  const canImport = user?.role === Role.ADMIN || user?.role === Role.ACCOUNTANT;
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [source, setSource] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(
    searchText,
    SEARCH_DEBOUNCE_MS,
    useCallback(() => {
      setPage(1);
    }, []),
  );
  const [selectedTxn, setSelectedTxn] = useState<TransactionSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const queryUrl = buildTransactionsUrl({
    page,
    status,
    source,
    fromDate,
    toDate,
    search: debouncedSearch,
  });
  const hasActiveFilters = Boolean(
    status || source || fromDate || toDate || debouncedSearch.trim(),
  );
  const statusLabel = STATUS_OPTIONS.find((option) => option.value === status)?.label;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['transactions', page, status, source, fromDate, toDate, debouncedSearch],
    queryFn: () => getApiData<TransactionListResponse>(queryUrl),
    // Fallback polling nếu SSE disconnect; SSE thường invalidate trước 30s này
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const isSearchPending = searchText !== debouncedSearch;

  const pendingOnPage = useMemo(
    () => items.filter((txn) => isPendingTransaction(txn.status)),
    [items],
  );
  const selectedPendingCount = useMemo(
    () => pendingOnPage.filter((txn) => selectedIds.has(txn.id)).length,
    [pendingOnPage, selectedIds],
  );
  const allPendingOnPageSelected =
    pendingOnPage.length > 0 && selectedPendingCount === pendingOnPage.length;

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, status, source, fromDate, toDate, debouncedSearch]);

  const bulkReclassifyMutation = useMutation({
    mutationFn: (ids: string[]) =>
      postApiData<BulkReclassifyResult>('/transactions/bulk-reclassify', { ids }),
    onSuccess: (result) => {
      const skippedNote =
        result.skipped > 0 ? ` (${result.skipped} GD bỏ qua vì không đủ điều kiện)` : '';
      toast.success(`Đã gửi ${result.queued} giao dịch cho AI định khoản lại${skippedNote}`);
      setSelectedIds(new Set());
      setBulkConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, 'Không thể gửi yêu cầu định khoản hàng loạt')),
  });

  function toggleSelection(txn: TransactionSummary, checked: boolean) {
    if (!isPendingTransaction(txn.status)) {
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(txn.id);
      } else {
        next.delete(txn.id);
      }
      return next;
    });
  }

  function toggleSelectAllPendingOnPage(checked: boolean) {
    if (!checked) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const txn of pendingOnPage) {
          next.delete(txn.id);
        }
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const txn of pendingOnPage) {
        next.add(txn.id);
      }
      return next;
    });
  }

  function handleBulkReclassify() {
    const ids = pendingOnPage.filter((txn) => selectedIds.has(txn.id)).map((txn) => txn.id);
    if (ids.length === 0) {
      return;
    }
    bulkReclassifyMutation.mutate(ids);
  }

  function openDetail(txn: TransactionSummary) {
    setSelectedTxn(txn);
    setSheetOpen(true);
  }

  function clearFilters() {
    setStatus('');
    setSource('');
    setFromDate('');
    setToDate('');
    setSearchText('');
    setPage(1);
  }

  return (
    <>
      <Header
        title="Giao dịch"
        description="Danh sách giao dịch ngân hàng nhận qua Cas Balance Hook"
        actions={
          <div className="flex items-center gap-2">
            {canImport && (
              <Button size="sm" onClick={() => setImportDialogOpen(true)}>
                <FileSpreadsheet className="mr-2 size-4" />
                Nhập từ Excel
              </Button>
            )}
            <Button variant="link" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <Card className="py-4">
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="txn-search">Tìm nội dung</Label>
                <Input
                  id="txn-search"
                  placeholder="Tìm theo nội dung, mã GD, người gửi..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="txn-status">Trạng thái</Label>
                <Select
                  value={status || 'all'}
                  onValueChange={(value) => {
                    setStatus(value === 'all' ? '' : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="txn-status" className="w-full">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="txn-source">Nguồn</Label>
                <Select
                  value={source || 'all'}
                  onValueChange={(value) => {
                    setSource(value === 'all' ? '' : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="txn-source" className="w-full">
                    <SelectValue placeholder="Tất cả nguồn" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="txn-from">Từ ngày</Label>
                  <Input
                    id="txn-from"
                    type="date"
                    value={fromDate}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-to">Đến ngày</Label>
                  <Input
                    id="txn-to"
                    type="date"
                    value={toDate}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Đang lọc:</span>
                {status ? (
                  <Badge variant="secondary">Trạng thái: {statusLabel ?? status}</Badge>
                ) : null}
                {source ? (
                  <Badge variant="secondary">
                    Nguồn: {source === 'cas' ? 'Ngân hàng' : 'Import Excel'}
                  </Badge>
                ) : null}
                {fromDate ? <Badge variant="secondary">Từ {fromDate}</Badge> : null}
                {toDate ? <Badge variant="secondary">Đến {toDate}</Badge> : null}
                {searchText ? <Badge variant="secondary">"{searchText}"</Badge> : null}
                {isSearchPending ? (
                  <span className="text-xs text-muted-foreground">Đang tìm...</span>
                ) : null}
                <Button variant="link" size="sm" className="h-auto px-1" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : isError ? (
          <Card className="border-destructive/30 bg-destructive/5 py-6">
            <CardContent className="text-center">
              <p className="text-sm text-destructive">Không thể tải danh sách giao dịch</p>
              <Button variant="link" size="sm" className="mt-3" onClick={() => refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        ) : !items.length ? (
          <Card className="py-4">
            <CardContent>
              <EmptyState
                className="border-0 bg-transparent py-6"
                icon={Receipt}
                title="Không tìm thấy giao dịch nào"
                description={
                  hasActiveFilters
                    ? 'Thử đổi bộ lọc hoặc xóa điều kiện tìm kiếm.'
                    : 'Giao dịch sẽ xuất hiện khi Cas gửi webhook sau khi liên kết ngân hàng.'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {canBulkReclassify && selectedIds.size > 0 ? (
              <Card className="border-primary/20 bg-primary/5 py-3">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">
                    Đã chọn {selectedIds.size} giao dịch
                    {selectedPendingCount < selectedIds.size ? (
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({selectedPendingCount} đang chờ xử lý)
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIds(new Set())}
                      disabled={bulkReclassifyMutation.isPending}
                    >
                      Bỏ chọn
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setBulkConfirmOpen(true)}
                      disabled={bulkReclassifyMutation.isPending || selectedPendingCount === 0}
                    >
                      {bulkReclassifyMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 size-4 animate-spin" />
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 size-4" />
                          Định khoản lại hàng loạt
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <div className="space-y-3 md:hidden">
              {items.map((txn) => {
                const selectable = canBulkReclassify && isPendingTransaction(txn.status);
                const checked = selectedIds.has(txn.id);

                return (
                  <Card key={txn.id} className="py-4 transition-colors hover:bg-muted/30">
                    <CardContent className="text-sm">
                      <div className="flex items-start gap-3">
                        {canBulkReclassify ? (
                          <Checkbox
                            checked={checked}
                            disabled={!selectable}
                            onCheckedChange={(value) => toggleSelection(txn, value === true)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Chọn giao dịch ${txn.transactionId}`}
                            className="mt-0.5"
                          />
                        ) : null}
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openDetail(txn)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-xs text-muted-foreground">
                                {formatTransactionTime(txn.transactionDate)}
                              </p>
                              <TransactionSourceBadge source={txn.source} />
                            </div>
                            <TransactionStatusBadge status={txn.status} />
                          </div>
                          <p className="mt-2 font-semibold">
                            <SignedTransactionAmount amount={Number(txn.amount)} />
                          </p>
                          <p className="mt-1 text-muted-foreground">{txn.content ?? '—'}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {txn.senderAccount ?? 'Không rõ người gửi'}
                            </p>
                            <ConfidenceBadge score={txn.confidenceScore} />
                          </div>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="hidden overflow-hidden py-0 md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    {canBulkReclassify ? (
                      <TableHead className="w-10 py-3">
                        <Checkbox
                          checked={allPendingOnPageSelected}
                          disabled={pendingOnPage.length === 0}
                          onCheckedChange={(value) => toggleSelectAllPendingOnPage(value === true)}
                          aria-label="Chọn tất cả giao dịch chờ xử lý trên trang"
                        />
                      </TableHead>
                    ) : null}
                    <TableHead className="py-3">Thời gian</TableHead>
                    <TableHead className="py-3">Nguồn</TableHead>
                    <TableHead className="py-3 text-right">Số tiền</TableHead>
                    <TableHead className="py-3">Nội dung</TableHead>
                    <TableHead className="py-3">Người gửi</TableHead>
                    <TableHead className="py-3 text-center">TK Nợ/Có</TableHead>
                    <TableHead className="py-3 text-center">Độ tin cậy</TableHead>
                    <TableHead className="py-3 text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((txn) => {
                    const selectable = canBulkReclassify && isPendingTransaction(txn.status);
                    const checked = selectedIds.has(txn.id);

                    return (
                      <TableRow key={txn.id} className="cursor-pointer">
                        {canBulkReclassify ? (
                          <TableCell className="w-10" onClick={(event) => event.stopPropagation()}>
                            <Checkbox
                              checked={checked}
                              disabled={!selectable}
                              onCheckedChange={(value) => toggleSelection(txn, value === true)}
                              aria-label={`Chọn giao dịch ${txn.transactionId}`}
                            />
                          </TableCell>
                        ) : null}
                        <TableCell
                          className="text-sm text-muted-foreground whitespace-nowrap"
                          onClick={() => openDetail(txn)}
                        >
                          {formatTransactionTime(txn.transactionDate)}
                        </TableCell>
                        <TableCell onClick={() => openDetail(txn)}>
                          <TransactionSourceBadge source={txn.source} />
                        </TableCell>
                        <TableCell
                          className="text-right font-semibold"
                          onClick={() => openDetail(txn)}
                        >
                          <SignedTransactionAmount amount={Number(txn.amount)} />
                        </TableCell>
                        <TableCell
                          className="max-w-[260px] truncate text-sm"
                          onClick={() => openDetail(txn)}
                        >
                          {txn.content ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm" onClick={() => openDetail(txn)}>
                          {txn.senderAccount ?? '—'}
                        </TableCell>
                        <TableCell
                          className="text-center font-mono text-xs"
                          onClick={() => openDetail(txn)}
                        >
                          {txn.classification ? (
                            <span>
                              {txn.classification.debitAccount}/{txn.classification.creditAccount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={() => openDetail(txn)}>
                          <ConfidenceBadge
                            score={txn.classification?.confidenceScore ?? txn.confidenceScore}
                          />
                        </TableCell>
                        <TableCell className="text-right" onClick={() => openDetail(txn)}>
                          <div className="flex justify-end">
                            <TransactionStatusBadge status={txn.status} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            {data ? (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {items.length} / {data.total} giao dịch
                </p>
                {data.total > PAGE_SIZE ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Trước
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Trang {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Sau
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <TransactionDetailSheet
        transaction={selectedTxn}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <ImportTransactionsDialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) refetch();
        }}
        onImported={() => {
          setSource('import');
          setPage(1);
        }}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title="Định khoản lại hàng loạt?"
        description={`Gửi ${selectedPendingCount} giao dịch đang chờ xử lý cho AI định khoản lại. Thao tác này có thể mất vài phút tùy số lượng.`}
        confirmLabel="Gửi cho AI"
        loading={bulkReclassifyMutation.isPending}
        onConfirm={handleBulkReclassify}
      />
    </>
  );
}
