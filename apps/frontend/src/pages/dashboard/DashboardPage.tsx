import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Brain, CheckCircle2, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { BankStatusCard } from '@/components/dashboard/BankStatusCard';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { RecentTransactionsCard } from '@/components/dashboard/RecentTransactionsCard';
import { RevenueLineChart } from '@/components/dashboard/RevenueLineChart';
import { TransactionStatusChart } from '@/components/dashboard/TransactionStatusChart';
import { Header } from '@/components/layout/Header';
import { WelcomeTour } from '@/components/shared/WelcomeTour';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { getApiData } from '@/lib/api';
import {
  buildDailyRevenueTrend,
  buildDashboardOverviewStats,
  buildTransactionStatusBreakdown,
  formatCurrency,
} from '@/lib/dashboard-transactions';
import type { TransactionListResponse } from '@/types/transaction';

const DASHBOARD_TRANSACTION_LIMIT = 100;

export default function DashboardPage() {
  const { user, onboardingStatus } = useAuth();
  const bankingLinked = Boolean(onboardingStatus?.bankingLinked);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', 'dashboard'],
    queryFn: () =>
      getApiData<TransactionListResponse>(`/transactions?limit=${DASHBOARD_TRANSACTION_LIMIT}`),
    enabled: bankingLinked,
    refetchInterval: 10_000,
  });

  const items = data?.items ?? [];
  const stats = useMemo(() => buildDashboardOverviewStats(items), [items]);
  const revenueTrend = useMemo(() => buildDailyRevenueTrend(items), [items]);
  const statusData = useMemo(() => buildTransactionStatusBreakdown(items), [items]);
  const recentItems = useMemo(() => items.slice(0, 5), [items]);

  const classifiedFooter =
    stats.classifiedChangePercent != null ? (
      <p
        className={
          stats.classifiedChangePercent >= 0 ? 'text-xs text-primary' : 'text-xs text-destructive'
        }
      >
        {stats.classifiedChangePercent >= 0 ? '↑' : '↓'}{' '}
        {Math.abs(stats.classifiedChangePercent).toFixed(1)}% so với hôm qua
      </p>
    ) : (
      <p className="text-xs text-muted-foreground">
        {stats.classifiedTodayCount > 0
          ? `Doanh thu hôm nay: ${formatCurrency(stats.todayRevenue)}`
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
        <div>
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

        <BankStatusCard bankingLinked={bankingLinked} grants={onboardingStatus?.grants ?? []} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {bankingLinked && isLoading ? (
            (['classified', 'pending', 'review', 'accuracy'] as const).map((key) => (
              <Skeleton key={key} className="h-[120px] w-full rounded-xl" />
            ))
          ) : (
            <>
              <DashboardStatCard
                label="Định khoản hôm nay"
                value={stats.classifiedTodayCount}
                icon={CheckCircle2}
                footer={classifiedFooter}
              />
              <DashboardStatCard
                label="Chờ định khoản"
                value={stats.pendingCount}
                icon={Clock}
                footer={<p className="text-xs text-muted-foreground">Đang chờ AI xử lý</p>}
              />
              <DashboardStatCard
                label="Chờ Human Review"
                value={stats.reviewCount}
                icon={AlertCircle}
                footer={
                  stats.reviewCount > 0 ? (
                    <p className="text-xs text-amber-600">Cần kế toán xem xét</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Không có giao dịch cần xem xét</p>
                  )
                }
              />
              <DashboardStatCard
                label="Độ chính xác AI"
                value={
                  stats.aiAccuracyPercent != null ? `${stats.aiAccuracyPercent.toFixed(1)}%` : '—'
                }
                icon={Brain}
                footer={
                  <p className="text-xs text-muted-foreground">Tỷ lệ tự tin ≥ 85% (ngưỡng TT133)</p>
                }
              />
            </>
          )}
        </div>

        <RevenueLineChart data={revenueTrend} isLoading={bankingLinked && isLoading} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentTransactionsCard items={recentItems} isLoading={bankingLinked && isLoading} />
          </div>
          <TransactionStatusChart data={statusData} isLoading={bankingLinked && isLoading} />
        </div>
      </div>
    </>
  );
}
