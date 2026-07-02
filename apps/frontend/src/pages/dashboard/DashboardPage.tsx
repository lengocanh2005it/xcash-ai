import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Crown, Receipt } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BankStatusCard } from '@/components/dashboard/BankStatusCard';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { RecentTransactionsCard } from '@/components/dashboard/RecentTransactionsCard';
import { TransactionStatusChart } from '@/components/dashboard/TransactionStatusChart';
import { TransactionTrendChart } from '@/components/dashboard/TransactionTrendChart';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { getApiData } from '@/lib/api';
import {
  buildDailyTransactionTrend,
  buildTransactionStatusBreakdown,
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

  const trendData = useMemo(() => buildDailyTransactionTrend(data?.items ?? []), [data?.items]);
  const statusData = useMemo(
    () => buildTransactionStatusBreakdown(data?.items ?? []),
    [data?.items],
  );
  const recentItems = useMemo(() => (data?.items ?? []).slice(0, 5), [data?.items]);

  return (
    <>
      <Header title="Dashboard" description={`Xin chào, ${user?.name ?? 'bạn'}`} />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <BankStatusCard bankingLinked={bankingLinked} grants={onboardingStatus?.grants ?? []} />

          <DashboardStatCard
            label="Tổng giao dịch"
            value={data?.total ?? 0}
            icon={Receipt}
            footer={
              <Button asChild size="sm" variant="ghost" className="h-auto px-0">
                <Link to="/transactions">
                  Xem giao dịch
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          />

          <DashboardStatCard
            label="Gói dịch vụ"
            value="Free"
            icon={Crown}
            footer={
              <p className="text-sm text-muted-foreground">Nâng cấp gói sẽ có ở Sprint sau</p>
            }
          />
        </div>

        <TransactionTrendChart data={trendData} isLoading={bankingLinked && isLoading} />

        <div className="grid gap-4 lg:grid-cols-2">
          <RecentTransactionsCard items={recentItems} isLoading={bankingLinked && isLoading} />
          <TransactionStatusChart data={statusData} isLoading={bankingLinked && isLoading} />
        </div>
      </div>
    </>
  );
}
