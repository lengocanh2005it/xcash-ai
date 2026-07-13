import { useState } from 'react';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';

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
const DEFAULT_FILTERS = {
  search: '',
  action: 'all',
  entityType: 'all',
  fromDate: '',
  toDate: '',
};

export function useAuditLog(endpoint: string) {
  const [selectedItem, setSelectedItem] = useState<AuditLogItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    data,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading,
    isFetching,
  } = useFilteredPagination({
    queryKey: ['audit-logs', endpoint],
    queryFn: ({ filters, page }) =>
      api
        .get<{ data: AuditLogsResponse }>(endpoint, {
          params: {
            page,
            limit: PAGE_SIZE,
            search: filters.search.trim() || undefined,
            action: filters.action !== 'all' ? filters.action : undefined,
            entityType: filters.entityType !== 'all' ? filters.entityType : undefined,
            fromDate: filters.fromDate || undefined,
            toDate: filters.toDate || undefined,
          },
        })
        .then((response) => response.data.data),
    defaultFilters: DEFAULT_FILTERS,
    debounceMs: 350,
    keepPrevious: true,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const isSearchPending = filters.search !== debouncedFilters.search;

  const hasActiveFilters =
    debouncedFilters.search.trim() !== '' ||
    debouncedFilters.action !== 'all' ||
    debouncedFilters.entityType !== 'all' ||
    debouncedFilters.fromDate !== '' ||
    debouncedFilters.toDate !== '';

  const clearFilters = () => resetFilters();

  const openDetail = (item: AuditLogItem) => {
    setSelectedItem(item);
    setSheetOpen(true);
  };

  return {
    items,
    total,
    totalPages,
    isLoading,
    isFetching,
    isSearchPending,
    hasActiveFilters,
    filters,
    setFilter,
    clearFilters,
    page,
    setPage,
    selectedItem,
    sheetOpen,
    setSheetOpen,
    openDetail,
  };
}
