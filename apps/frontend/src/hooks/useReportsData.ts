import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SubscriptionPlan } from '@xcash/shared-types';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { api, getApiData } from '@/lib/api';
import { hasPlanAccess, PLAN_LABEL } from '@/lib/plan';
import type { AccountBreakdownData, SummaryData } from '@/types/api/reports';
import { useAuth } from './useAuth';
import { useDebouncedValue } from './useDebouncedValue';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

async function fetchSummary(year: number, month: number): Promise<SummaryData> {
  return getApiData<SummaryData>(`/reports/summary?year=${year}&month=${month}`);
}

function buildAccountBreakdownUrl(params: {
  year: number;
  month: number;
  page: number;
  search: string;
  accountType: string;
}) {
  const query = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });

  if (params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params.accountType && params.accountType !== 'all') {
    query.set('accountType', params.accountType);
  }

  return `/reports/account-breakdown?${query.toString()}`;
}

export function useReportsData() {
  const now = new Date();
  const yearOptions = [now.getFullYear() - 1, now.getFullYear()];
  const { user } = useAuth();
  const canExport = hasPlanAccess(user?.plan, SubscriptionPlan.PRO);
  const requiredPlanLabel = PLAN_LABEL[SubscriptionPlan.PRO];

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState('all');

  const debouncedSearch = useDebouncedValue(
    searchText,
    SEARCH_DEBOUNCE_MS,
    useCallback(() => {
      setPage(1);
    }, []),
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports-summary', year, month],
    queryFn: () => fetchSummary(year, month),
  });

  const {
    data: accountData,
    isLoading: loadingAccounts,
    isFetching: fetchingAccounts,
    isError: accountError,
    refetch: refetchAccounts,
  } = useQuery({
    queryKey: ['reports-account-breakdown', year, month, page, debouncedSearch, accountTypeFilter],
    queryFn: () =>
      getApiData<AccountBreakdownData>(
        buildAccountBreakdownUrl({
          year,
          month,
          page,
          search: debouncedSearch,
          accountType: accountTypeFilter,
        }),
      ),
    placeholderData: keepPreviousData,
  });

  const accountItems = accountData?.items ?? [];
  const accountTotal = accountData?.total ?? 0;
  const totalPages = accountData ? Math.max(1, Math.ceil(accountData.total / PAGE_SIZE)) : 1;
  const hasAccountFilters = Boolean(debouncedSearch.trim() || accountTypeFilter !== 'all');
  const isSearchPending = searchText !== debouncedSearch;

  const handleExport = async () => {
    try {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      const res = await api.get(`/reports/export?from=${from}&to=${to}`, {
        responseType: 'blob',
      });

      const blob = res.data as Blob;
      if (blob.type.includes('json')) {
        const message = JSON.parse(await blob.text()) as {
          error?: { message?: string };
        };
        throw new Error(message.error?.message ?? 'Phản hồi export không hợp lệ');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-dinh-khoan-${from}-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống báo cáo Excel');
    } catch {
      toast.error('Không thể xuất báo cáo');
    }
  };

  const clearAccountFilters = () => {
    setSearchText('');
    setAccountTypeFilter('all');
    setPage(1);
  };

  const handlePeriodChange = (nextYear: number, nextMonth: number) => {
    setYear(nextYear);
    setMonth(nextMonth);
    setPage(1);
  };

  return {
    year,
    month,
    yearOptions,
    canExport,
    requiredPlanLabel,
    data,
    isLoading,
    isError,
    refetch,
    accountItems,
    accountTotal,
    totalPages,
    hasAccountFilters,
    isSearchPending,
    loadingAccounts,
    fetchingAccounts,
    accountError,
    refetchAccounts,
    searchText,
    accountTypeFilter,
    debouncedSearch,
    page,
    setPage,
    setSearchText,
    setAccountTypeFilter,
    handleExport,
    clearAccountFilters,
    handlePeriodChange,
    PAGE_SIZE,
  };
}
