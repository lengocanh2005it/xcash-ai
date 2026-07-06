import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Brain, CheckCircle2, Clock, Landmark } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { RecentTransactionsCard } from '@/components/dashboard/RecentTransactionsCard';
import { RevenueLineChart } from '@/components/dashboard/RevenueLineChart';
import { TransactionStatusChart } from '@/components/dashboard/TransactionStatusChart';
import { Header } from '@/components/layout/Header';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { WelcomeTour } from '@/components/shared/WelcomeTour';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useReviewCount } from '@/hooks/useReviewCount';
import { getApiData } from '@/lib/api';
import {
  buildDailyRevenueTrend,
  buildTransactionStatusBreakdown,
} from '@/lib/dashboard-transactions';
import { dayIsoRange } from '@/lib/date-range';
import type { TransactionListResponse } from '@/types/transaction';

const CHART_TRANSACTION_LIMIT = 100;

interface SummaryData {
  period: { year: number; month: number };
  summary: { totalRevenue: number; totalExpense: number; net: number };
  stats: { totalCount: number; classifiedCount: number; reviewCount: number; aiAccuracy: number };
}

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

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['reports', 'summary', year, month, 'dashboard'],
    queryFn: () => getApiData<SummaryData>(`/reports/summary?year=${year}&month=${month}`),
    enabled: bankingLinked,
    refetchInterval: 10_000,
  });

  const { data: reviewCount, isLoading: loadingReviewCount } = useReviewCount();

  const { data: pendingData, isLoading: loadingPending } = useQuery({
    queryKey: ['transactions', 'dashboard', 'pending-count'],
    queryFn: () => getApiData<TransactionListResponse>('/transactions?status=pending&limit=1'),
    enabled: bankingLinked,
    refetchInterval: 10_000,
  });

  const { data: classifiedTodayData, isLoading: loadingClassifiedToday } = useQuery({
    queryKey: ['transactions', 'dashboard', 'classified-today'],
    queryFn: () =>
      getApiData<TransactionListResponse>(
        buildTransactionsCountUrl('classified', todayRange.from, todayRange.to),
      ),
    enabled: bankingLinked,
    refetchInterval: 10_000,
  });

  const { data: classifiedYesterdayData } = useQuery({
    queryKey: ['transactions', 'dashboard', 'classified-yesterday'],
    queryFn: () =>
      getApiData<TransactionListResponse>(
        buildTransactionsCountUrl('classified', yesterdayRange.from, yesterdayRange.to),
      ),
    enabled: bankingLinked,
    refetchInterval: 10_000,
  });

  const { data: chartData, isLoading: loadingCharts } = useQuery({
    queryKey: ['transactions', 'dashboard', 'charts'],
    queryFn: () =>
      getApiData<TransactionListResponse>(`/transactions?limit=${CHART_TRANSACTION_LIMIT}`),
    enabled: bankingLinked,
    refetchInterval: 10_000,
  });

  const items = chartData?.items ?? [];
  const classifiedTodayCount = classifiedTodayData?.total ?? 0;
  const classifiedYesterdayCount = classifiedYesterdayData?.total ?? 0;
  const classifiedChangePercent =
    classifiedYesterdayCount > 0
      ? ((classifiedTodayCount - classifiedYesterdayCount) / classifiedYesterdayCount) * 100
      : null;

  const revenueTrend = useMemo(() => buildDailyRevenueTrend(items), [items]);
  const statusData = useMemo(() => buildTransactionStatusBreakdown(items), [items]);
  const recentItems = useMemo(() => items.slice(0, 5), [items]);

  const statsLoading =
    bankingLinked &&
    (loadingSummary ||
      loadingReviewCount ||
      loadingPending ||
      loadingClassifiedToday ||
      loadingCharts);

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

      <div className="space-y-6 p-4 sm:p-6">
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

        <RevenueLineChart data={revenueTrend} isLoading={statsLoading} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <RecentTransactionsCard items={recentItems} isLoading={statsLoading} />
          </div>
          <div className="min-w-0">
            <TransactionStatusChart data={statusData} isLoading={statsLoading} />
          </div>
        </div>
      </div>
    </>
  );
}
