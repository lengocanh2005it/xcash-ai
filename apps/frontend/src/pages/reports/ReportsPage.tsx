import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SubscriptionPlan } from '@xcash/shared-types';
import { Brain, Download, Scale, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api, getApiData } from '@/lib/api';
import { formatVND } from '@/lib/format-vnd';
import { hasPlanAccess, PLAN_LABEL } from '@/lib/plan';

interface SummaryData {
  period: { year: number; month: number };
  summary: { totalRevenue: number; totalExpense: number; net: number };
  stats: { totalCount: number; classifiedCount: number; reviewCount: number; aiAccuracy: number };
}

interface AccountRow {
  accountCode: string;
  accountName: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  net: number;
  transactionCount: number;
}

interface AccountBreakdownData {
  items: AccountRow[];
  page: number;
  limit: number;
  total: number;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả loại TK' },
  { value: 'asset', label: 'Tài sản' },
  { value: 'liability', label: 'Nợ phải trả' },
  { value: 'equity', label: 'Vốn chủ sở hữu' },
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'expense', label: 'Chi phí' },
];

async function fetchSummary(year: number, month: number): Promise<SummaryData> {
  const res = await api.get(`/reports/summary?year=${year}&month=${month}`);
  return res.data.data;
}

function buildAccountBreakdownUrl(params: {
  year: number;
  month: number;
  page: number;
  search: string;
  accountType: string;
}) {
  const search = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });

  if (params.search.trim()) {
    search.set('search', params.search.trim());
  }
  if (params.accountType && params.accountType !== 'all') {
    search.set('accountType', params.accountType);
  }

  return `/reports/account-breakdown?${search.toString()}`;
}

export default function ReportsPage() {
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

  return (
    <>
      <Header
        title="Báo cáo định khoản"
        description="Tổng hợp thu chi theo tài khoản TT133"
        actions={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Select
              value={String(month)}
              onValueChange={(v) => handlePeriodChange(year, Number(v))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(year)}
              onValueChange={(v) => handlePeriodChange(Number(v), month)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canExport ? (
              <Button onClick={handleExport} disabled={isLoading}>
                <Download className="mr-2 size-4" />
                Xuất Excel
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-not-allowed">
                    <Button disabled className="pointer-events-none">
                      <Download className="mr-2 size-4" />
                      Xuất Excel
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Nâng cấp lên gói {requiredPlanLabel} để mở khóa tính năng Xuất Excel
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(['revenue', 'expense', 'net', 'accuracy'] as const).map((k) => (
              <Skeleton key={k} className="h-[120px] w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <Card className="border-destructive/30 bg-destructive/5 py-6">
            <CardContent className="text-center">
              <p className="text-sm text-destructive">
                Không thể tải báo cáo tháng {month}/{year}
              </p>
              <Button variant="link" size="sm" className="mt-3" onClick={() => refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DashboardStatCard
                label="Tổng thu"
                value={
                  <span className="text-green-600">{formatVND(data.summary.totalRevenue)}</span>
                }
                icon={TrendingUp}
                footer={
                  <p className="text-xs text-muted-foreground">
                    Tổng phát sinh Có trên TK doanh thu (5xx) đã định khoản
                  </p>
                }
              />
              <DashboardStatCard
                label="Tổng chi"
                value={<span className="text-red-600">{formatVND(data.summary.totalExpense)}</span>}
                icon={TrendingDown}
                footer={
                  <p className="text-xs text-muted-foreground">
                    Tổng phát sinh Nợ trên TK chi phí (6xx) đã định khoản
                  </p>
                }
              />
              <DashboardStatCard
                label="Lãi/Lỗ"
                value={
                  <span className={data.summary.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatVND(data.summary.net)}
                  </span>
                }
                icon={Scale}
                footer={
                  <p className="text-xs text-muted-foreground">
                    Chênh lệch thu − chi trong tháng đã chọn
                  </p>
                }
              />
              <DashboardStatCard
                label="Độ chính xác AI"
                value={`${data.stats.aiAccuracy}%`}
                icon={Brain}
                footer={
                  <p className="text-xs text-muted-foreground">
                    {data.stats.classifiedCount}/{data.stats.totalCount} giao dịch đã hoàn tất định
                    khoản
                  </p>
                }
              />
            </div>

            <Card>
              <CardHeader className="space-y-4">
                <CardTitle>Chi tiết theo tài khoản</CardTitle>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="account-search">Tìm tài khoản</Label>
                    <div className="relative">
                      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="account-search"
                        placeholder="Mã hoặc tên tài khoản..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="account-type">Loại tài khoản</Label>
                    <Select
                      value={accountTypeFilter}
                      onValueChange={(value) => {
                        setAccountTypeFilter(value);
                        setPage(1);
                      }}
                    >
                      <SelectTrigger id="account-type" className="w-full">
                        <SelectValue placeholder="Tất cả loại TK" />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {hasAccountFilters || isSearchPending ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {debouncedSearch.trim() ? (
                      <Badge variant="secondary">"{debouncedSearch.trim()}"</Badge>
                    ) : null}
                    {accountTypeFilter !== 'all' ? (
                      <Badge variant="secondary">
                        {ACCOUNT_TYPE_OPTIONS.find((o) => o.value === accountTypeFilter)?.label}
                      </Badge>
                    ) : null}
                    {isSearchPending ? (
                      <span className="text-xs text-muted-foreground">Đang tìm...</span>
                    ) : null}
                    {hasAccountFilters ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-1"
                        onClick={clearAccountFilters}
                      >
                        Xóa bộ lọc
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {loadingAccounts ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => `skel-acc-${i}`).map((k) => (
                      <Skeleton key={k} className="h-10 w-full" />
                    ))}
                  </div>
                ) : accountError ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-destructive">
                      Không thể tải chi tiết theo tài khoản
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-2"
                      onClick={() => refetchAccounts()}
                    >
                      Thử lại
                    </Button>
                  </div>
                ) : !accountItems.length ? (
                  <EmptyState
                    title={
                      hasAccountFilters ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có dữ liệu'
                    }
                    description={
                      hasAccountFilters
                        ? 'Thử đổi từ khóa hoặc bộ lọc khác'
                        : 'Chưa có giao dịch nào được định khoản trong tháng này'
                    }
                    action={
                      hasAccountFilters ? (
                        <Button variant="outline" size="sm" onClick={clearAccountFilters}>
                          Xóa bộ lọc
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <>
                    <div className="space-y-3 lg:hidden">
                      {accountItems.map((a) => (
                        <Card key={a.accountCode} className="py-4">
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-mono font-semibold">{a.accountCode}</p>
                                <p className="text-muted-foreground">{a.accountName}</p>
                              </div>
                              <Badge variant="outline">{a.transactionCount} GD</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">Phát sinh Nợ</p>
                                <p className="font-mono text-red-600">{formatVND(a.totalDebit)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Phát sinh Có</p>
                                <p className="font-mono text-green-600">
                                  {formatVND(a.totalCredit)}
                                </p>
                              </div>
                            </div>
                            <p
                              className={`font-mono font-medium ${a.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
                            >
                              Số dư: {formatVND(a.net)}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="pb-3 pr-4 font-medium">Mã TK</th>
                            <th className="pb-3 pr-4 font-medium">Tên tài khoản</th>
                            <th className="pb-3 pr-4 font-medium">Phát sinh Nợ</th>
                            <th className="pb-3 pr-4 font-medium">Phát sinh Có</th>
                            <th className="pb-3 pr-4 font-medium">Số dư</th>
                            <th className="pb-3 font-medium">Số GD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {accountItems.map((a) => (
                            <tr key={a.accountCode} className="hover:bg-muted/30">
                              <td className="py-3 pr-4 font-mono font-medium">{a.accountCode}</td>
                              <td className="py-3 pr-4">{a.accountName}</td>
                              <td className="py-3 pr-4 font-mono text-red-600">
                                {formatVND(a.totalDebit)}
                              </td>
                              <td className="py-3 pr-4 font-mono text-green-600">
                                {formatVND(a.totalCredit)}
                              </td>
                              <td
                                className={`py-3 pr-4 font-mono font-medium ${a.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
                              >
                                {formatVND(a.net)}
                              </td>
                              <td className="py-3 text-muted-foreground">{a.transactionCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {accountTotal > PAGE_SIZE ? (
                      <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <p className="text-sm text-muted-foreground">
                          Hiển thị {accountItems.length} / {accountTotal} tài khoản
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1 || fetchingAccounts}
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
                            disabled={page >= totalPages || fetchingAccounts}
                            onClick={() => setPage((current) => current + 1)}
                          >
                            Sau
                          </Button>
                        </div>
                      </div>
                    ) : accountTotal > 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">
                        {accountTotal} tài khoản có phát sinh trong tháng
                      </p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </>
  );
}
