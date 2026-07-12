import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiData, postApiData } from '@/lib/api';
import type { ReviewQueueResponse } from '@/types/api/review';
import { useFilteredPagination } from './useFilteredPagination';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export const CONFIDENCE_OPTIONS: Array<{
  value: string;
  label: string;
  min?: number;
  max?: number;
}> = [
  { value: 'all', label: 'Tất cả độ tin cậy' },
  { value: 'low', label: 'Dưới 50%', max: 50 },
  { value: 'mid', label: '50% – 85%', min: 50, max: 85 },
];

function buildReviewQueueUrl(params: { page: number; search: string; confidence: string }): string {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });
  if (params.search.trim()) {
    query.set('search', params.search.trim());
  }
  const band = CONFIDENCE_OPTIONS.find((o) => o.value === params.confidence);
  if (band?.min != null) {
    query.set('minConfidence', String(band.min));
  }
  if (band?.max != null) {
    query.set('maxConfidence', String(band.max));
  }
  return `/review/queue?${query.toString()}`;
}

async function fetchReviewQueue(url: string): Promise<ReviewQueueResponse['data']> {
  return getApiData<ReviewQueueResponse['data']>(url);
}

async function confirmReview(id: string) {
  await postApiData<void>(`/review/${id}/confirm`);
}

async function correctReview(id: string, debitAccount: string, creditAccount: string) {
  await postApiData<void>(`/review/${id}/correct`, { debitAccount, creditAccount });
}

async function skipReview(id: string) {
  await postApiData<void>(`/review/${id}/skip`);
}

export const ACCOUNT_CODE_PATTERN = /^\d{3,4}$/;

export function useReviewQueue() {
  const queryClient = useQueryClient();

  const { data, filters, debouncedFilters, setFilter, resetFilters, page, setPage, isLoading } =
    useFilteredPagination({
      queryKey: ['review-queue'],
      queryFn: ({ filters: f, page: p }) =>
        fetchReviewQueue(
          buildReviewQueueUrl({ page: p, search: f.search, confidence: f.confidence }),
        ),
      defaultFilters: { search: '', confidence: 'all' },
      debounceMs: SEARCH_DEBOUNCE_MS,
      keepPrevious: true,
      refetchInterval: 15_000,
    });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const hasActiveFilters = Boolean(
    debouncedFilters.search.trim() || debouncedFilters.confidence !== 'all',
  );
  const isSearchPending = filters.search !== debouncedFilters.search;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    queryClient.invalidateQueries({ queryKey: ['review', 'count'] });
  };

  const confirmMutation = useMutation({
    mutationFn: confirmReview,
    onSuccess: () => {
      toast.success('Đã xác nhận định khoản');
      invalidate();
    },
    onError: () => toast.error('Không thể xác nhận'),
  });

  const correctMutation = useMutation({
    mutationFn: ({ id, d, c }: { id: string; d: string; c: string }) => correctReview(id, d, c),
    onSuccess: () => {
      toast.success('Đã sửa và xác nhận định khoản');
      invalidate();
    },
    onError: () => toast.error('Không thể sửa định khoản'),
  });

  const skipMutation = useMutation({
    mutationFn: skipReview,
    onSuccess: () => {
      toast.success('Đã bỏ qua');
      invalidate();
    },
    onError: () => toast.error('Không thể bỏ qua'),
  });

  return {
    data,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading,
    totalPages,
    hasActiveFilters,
    isSearchPending,
    confirmMutation,
    correctMutation,
    skipMutation,
    PAGE_SIZE,
  };
}
