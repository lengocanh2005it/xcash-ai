import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { useTransactionEvents } from '@/hooks/useTransactionEvents';
import { getApiData, postApiData } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { canBulkReclassify as canBulkReclassifyFn, canImportTransactions } from '@/lib/rbac';
import type { TransactionListResponse, TransactionSummary } from '@/types/transaction';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

interface BulkReclassifyResult {
  queued: number;
  skipped: number;
}

function isPendingTransaction(status: string) {
  return status === 'pending';
}

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

export function useTransactionsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  useTransactionEvents();
  const canBulkReclassify = canBulkReclassifyFn(user?.role);
  const canImport = canImportTransactions(user?.role);
  const [statusInit] = useState(() => searchParams.get('status') ?? '');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState<TransactionSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const {
    data,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useFilteredPagination({
    queryKey: ['transactions'],
    queryFn: ({ filters, page }) =>
      getApiData<TransactionListResponse>(
        buildTransactionsUrl({
          page,
          status: filters.status,
          source: filters.source,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          search: filters.search,
        }),
      ),
    defaultFilters: { status: statusInit, source: '', fromDate: '', toDate: '', search: '' },
    debounceMs: SEARCH_DEBOUNCE_MS,
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasActiveFilters = Boolean(
    filters.status ||
      filters.source ||
      filters.fromDate ||
      filters.toDate ||
      debouncedFilters.search.trim(),
  );

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

  const { status, source, fromDate, toDate, search } = debouncedFilters;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally clear selection whenever page or any debounced filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, status, source, fromDate, toDate, search]);

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
    resetFilters();
  }

  return {
    items,
    data,
    totalPages,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading,
    isError,
    isFetching,
    refetch,
    hasActiveFilters,
    canBulkReclassify,
    canImport,
    selectedIds,
    setSelectedIds,
    pendingOnPage,
    selectedPendingCount,
    allPendingOnPageSelected,
    bulkReclassifyMutation,
    toggleSelection,
    toggleSelectAllPendingOnPage,
    handleBulkReclassify,
    importDialogOpen,
    setImportDialogOpen,
    selectedTxn,
    setSelectedTxn,
    sheetOpen,
    setSheetOpen,
    bulkConfirmOpen,
    setBulkConfirmOpen,
    openDetail,
    clearFilters,
  };
}
