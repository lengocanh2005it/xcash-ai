import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Brain, CheckCircle2, Clock, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CashflowTrendChart } from '@/components/dashboard/CashflowTrendChart';
import { DashboardActivityChart } from '@/components/dashboard/DashboardActivityChart';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { MonthlyOverviewCard } from '@/components/dashboard/MonthlyOverviewCard';
import { RecentTransactionsCard } from '@/components/dashboard/RecentTransactionsCard';
import { TransactionSourceChart } from '@/components/dashboard/TransactionSourceChart';
import { TransactionStatusChart } from '@/components/dashboard/TransactionStatusChart';
import { Header } from '@/components/layout/Header';
import { ErrorRetryCard } from '@/components/shared/ErrorRetryCard';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { WelcomeTour } from '@/components/shared/WelcomeTour';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCount } from '@/hooks/useReviewCount';
import { getApiData } from '@/lib/api';
import {
  type DailyTrendApiResponse,
  mapDailyTrendResponse,
  mapSourceBreakdownResponse,
  mapStatusBreakdownResponse,
  type SourceBreakdownApiResponse,
  type StatusBreakdownApiResponse,
} from '@/lib/dashboard-transactions';
import { dayIsoRange } from '@/lib/date';
import type { SummaryData } from '@/types/api/reports';
import type { TransactionListResponse } from '@/types/transaction';

const RECENT_TRANSACTION_LIMIT = 8;
const DAILY_TREND_DAYS = 7;
/** Giảm tải server — dashboard không cần realtime từng giây (review count có hook riêng). */
const DASHBOARD_REFETCH_MS = 30_000;

function buildTransactionsCountUrl(status: string, from: string, to: string) {
  const params = new URLSearchParams({
    page: '1',
    limit: '1',
    status,
    from_date: from,
    to_date: to,
  });
  return `/transactions?${params.toString()}`;
}

export default function DashboardPage() {
  const { user, onboardingStatus } = useAuth();
  const bankingLinked = Boolean(onboardingStatus?.bankingLinked);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const todayRange = dayIsoRange(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayRange = dayIsoRange(yesterday);

  const {
    data: summary,
    isLoading: loadingSummary,
    isError: errorSummary,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['reports', 'summary', year, month, 'dashboard'],
    queryFn: () => getApiData<SummaryData>(`/reports/summary?year=${year}&month=${month}`),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: reviewCount, isLoading: loadingReviewCount } = useReviewCount();

  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ['transactions', 'dashboard', 'pending-count'],
    queryFn: () => getApiData<TransactionListResponse>('/transactions?status=pending&limit=1'),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: classifiedTodayData, isLoading: loadingClassifiedToday } = useQuery({
    queryKey: ['transactions', 'dashboard', 'classified-today'],
    queryFn: () =>
      getApiData<TransactionListResponse>(
        buildTransactionsCountUrl('classified', todayRange.from, todayRange.to),
      ),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: classifiedYesterdayData } = useQuery({
    queryKey: ['transactions', 'dashboard', 'classified-yesterday'],
    queryFn: () =>
      getApiData<TransactionListResponse>(
        buildTransactionsCountUrl('classified', yesterdayRange.from, yesterdayRange.to),
      ),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: dailyTrendData, isLoading: loadingDailyTrend } = useQuery({
    queryKey: ['reports', 'daily-trend', DAILY_TREND_DAYS, 'dashboard'],
    queryFn: () =>
      getApiData<DailyTrendApiResponse>(`/reports/daily-trend?days=${DAILY_TREND_DAYS}`),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: statusBreakdownData, isLoading: loadingStatusBreakdown } = useQuery({
    queryKey: ['reports', 'status-breakdown', 'dashboard'],
    queryFn: () => getApiData<StatusBreakdownApiResponse>('/reports/status-breakdown'),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: sourceBreakdownData, isLoading: loadingSourceBreakdown } = useQuery({
    queryKey: ['reports', 'source-breakdown', 'dashboard'],
    queryFn: () => getApiData<SourceBreakdownApiResponse>('/reports/source-breakdown'),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const { data: recentData, isLoading: loadingRecent } = useQuery({
    queryKey: ['transactions', 'dashboard', 'recent'],
    queryFn: () =>
      getApiData<TransactionListResponse>(`/transactions?limit=${RECENT_TRANSACTION_LIMIT}`),
    enabled: bankingLinked,
    refetchInterval: DASHBOARD_REFETCH_MS,
    refetchIntervalInBackground: false,
  });

  const dailyTrend = dailyTrendData ? mapDailyTrendResponse(dailyTrendData) : [];
  const statusData = statusBreakdownData ? mapStatusBreakdownResponse(statusBreakdownData) : [];
  const sourceData = sourceBreakdownData ? mapSourceBreakdownResponse(sourceBreakdownData) : [];
  const recentItems = recentData?.items ?? [];

  const classifiedTodayCount = classifiedTodayData?.total ?? 0;
  const classifiedYesterdayCount = classifiedYesterdayData?.total ?? 0;
  const classifiedChangePercent =
    classifiedYesterdayCount > 0
      ? ((classifiedTodayCount - classifiedYesterdayCount) / classifiedYesterdayCount) * 100
      : null;

  const chartsLoading =
    loadingDailyTrend || loadingStatusBreakdown || loadingSourceBreakdown || loadingRecent;

  const statsLoading =
    bankingLinked &&
    (loadingSummary ||
      loadingReviewCount ||
      loadingPending ||
      loadingClassifiedToday ||
      chartsLoading);

  const classifiedFooter =
    classifiedChangePercent != null ? (
      <p
        className={
          classifiedChangePercent >= 0 ? 'text-xs text-primary' : 'text-xs text-destructive'
        }
      >
        {classifiedChangePercent >= 0 ? '↑' : '↓'} {Math.abs(classifiedChangePercent).toFixed(1)}%
        so với hôm qua
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">
        {classifiedTodayCount > 0
          ? `${classifiedTodayCount} giao dịch đã định khoản hôm nay`
          : 'Chưa có GD định khoản hôm nay'}
      </p>
    );

  return (
    <>
      {user ? <WelcomeTour userId={user.id} /> : null}
      <Header
        title="Dashboard"
        description="Tổng quan hoạt động định khoản và giao dịch của doanh nghiệp"
      />

      <div className="space-y-5 p-4 sm:p-6">
        <Card className="overflow-hidden border-primary/15 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent py-0 shadow-sm">
          <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
            <UserAvatar
              name={user?.name}
              avatarUrl={user?.avatarUrl}
              size="md"
              className="shadow-sm"
            />
            <div className="min-w-0">
              <h2 className="text-xl font-medium text-foreground sm:text-2xl">
                Xin chào, <span className="font-bold text-primary">{user?.name ?? 'bạn'}</span>!
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {user?.businessName ? (
                  <>
                    Doanh nghiệp{' '}
                    <span className="font-medium text-foreground">{user.businessName}</span>
                    {' · '}
                  </>
                ) : null}
                Chúc bạn một ngày làm việc hiệu quả với X-Cash AI.
              </p>
            </div>
          </CardContent>
        </Card>

        {!bankingLinked ? (
          <Card className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Landmark className="size-5" />
                </div>
                <div>
                  <p className="font-medium">Chưa liên kết ngân hàng</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kết nối tài khoản qua Cas Link để giao dịch tự động đổ về và AI bắt đầu định
                    khoản.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/onboarding">Liên kết ngân hàng ngay</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statsLoading ? (
            (['classified', 'pending', 'review', 'accuracy'] as const).map((key) => (
              <Skeleton key={key} className="h-[120px] w-full rounded-xl" />
            ))
          ) : errorSummary && bankingLinked ? (
            <ErrorRetryCard
              title="Không thể tải dữ liệu dashboard"
              onRetry={() => refetchSummary()}
              className="col-span-full"
            />
          ) : (
            <>
              <DashboardStatCard
                label="Định khoản hôm nay"
                value={classifiedTodayCount}
                icon={CheckCircle2}
                footer={classifiedFooter}
                to="/transactions?status=classified"
              />
              <DashboardStatCard
                label="Chờ định khoản"
                value={pendingData?.total ?? 0}
                icon={Clock}
                footer={<p className="text-xs text-muted-foreground">Đang chờ AI xử lý</p>}
                to="/transactions?status=pending"
              />
              <DashboardStatCard
                label="Chờ Human Review"
                value={reviewCount ?? 0}
                icon={AlertCircle}
                footer={
                  (reviewCount ?? 0) > 0 ? (
                    <p className="text-xs text-amber-600">Cần kế toán xem xét</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Không có giao dịch cần xem xét</p>
                  )
                }
                to="/review"
              />
              <DashboardStatCard
                label="Độ chính xác AI"
                value={summary != null ? `${summary.stats.aiAccuracy}%` : '—'}
                icon={Brain}
                footer={
                  <p className="text-xs text-muted-foreground">
                    Tỷ lệ tự động định khoản tháng {month}/{year}
                  </p>
                }
              />
            </>
          )}
        </div>

        {bankingLinked ? (
          <MonthlyOverviewCard
            month={month}
            year={year}
            revenue={summary?.summary.totalRevenue ?? 0}
            expense={summary?.summary.totalExpense ?? 0}
            net={summary?.summary.net ?? 0}
            isLoading={loadingSummary}
          />
        ) : null}

        <CashflowTrendChart data={dailyTrend} isLoading={bankingLinked && loadingDailyTrend} />

        <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="grid gap-4">
            <TransactionStatusChart
              data={statusData}
              isLoading={bankingLinked && loadingStatusBreakdown}
            />
            <TransactionSourceChart
              data={sourceData}
              isLoading={bankingLinked && loadingSourceBreakdown}
            />
          </div>
          <DashboardActivityChart
            data={dailyTrend}
            isLoading={bankingLinked && loadingDailyTrend}
          />
        </div>

        <RecentTransactionsCard items={recentItems} isLoading={bankingLinked && loadingRecent} />
      </div>
    </>
  );
}
