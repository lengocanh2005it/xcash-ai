import { useQuery } from '@tanstack/react-query';
import { SubscriptionPlan } from '@xcash/shared-types';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Header } from '@/components/layout/Header';
import { ErrorRetryCard } from '@/components/shared/ErrorRetryCard';
import { PlanGate } from '@/components/shared/PlanGate';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatVND, formatVNDAxis } from '@/lib/format-vnd';
import { hasPlanAccess } from '@/lib/plan';
import type { ComparisonData, TopAccountsData } from '@/types/api/analytics';

const COLORS = ['#16AB64', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6'];

function PctBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span
      className={`text-xs font-medium flex items-center gap-0.5 ${positive ? 'text-green-600' : 'text-red-500'}`}
    >
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {positive ? '+' : ''}
      {value}%
    </span>
  );
}

export default function AnalyticsPage() {
  const now = new Date();
  const { user } = useAuth();
  const hasAccess = hasPlanAccess(user?.plan, SubscriptionPlan.STARTER);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const {
    data: comparison,
    isLoading: loadingComp,
    isError: errorComp,
    refetch: refetchComp,
  } = useQuery({
    queryKey: ['reports', 'comparison', year, month],
    enabled: hasAccess,
    queryFn: () =>
      api
        .get<{ data: ComparisonData }>(`/reports/comparison?year=${year}&month=${month}`)
        .then((r) => r.data.data),
  });

  const {
    data: topAccounts,
    isLoading: loadingTop,
    isError: errorTop,
    refetch: refetchTop,
  } = useQuery({
    queryKey: ['reports', 'top-accounts', year, month],
    enabled: hasAccess,
    queryFn: () =>
      api
        .get<{ data: TopAccountsData }>(`/reports/top-accounts?year=${year}&month=${month}&limit=5`)
        .then((r) => r.data.data),
  });

  const months = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Tháng ${i + 1}` }));
  const years = [now.getFullYear() - 1, now.getFullYear()];

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  return (
    <div className="flex h-full flex-col">
      <Header
        title="Phân tích"
        description="So sánh với tháng trước, top danh mục"
        actions={
          !hasAccess ? null : (
            <div className="flex flex-wrap gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        }
      />
      <PlanGate minPlan={SubscriptionPlan.STARTER} featureName="Phân tích">
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
          {/* Comparison stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loadingComp ? (
              Array.from({ length: 4 }, (_, i) => `skel-stat-${i}`).map((k) => (
                <Skeleton key={k} className="h-28" />
              ))
            ) : errorComp ? (
              <ErrorRetryCard
                title="Không thể tải dữ liệu so sánh"
                onRetry={() => refetchComp()}
                className="col-span-full"
              />
            ) : (
              comparison && (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Doanh thu tháng {month}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatVND(comparison.current.totalRevenue)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <PctBadge value={comparison.changes.revenue} />
                        <span className="text-xs text-muted-foreground">
                          vs tháng {prevMonth}/{prevYear}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Chi phí tháng {month}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {formatVND(comparison.current.totalExpense)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <PctBadge value={-comparison.changes.expense} />
                        <span className="text-xs text-muted-foreground">
                          vs tháng {prevMonth}/{prevYear}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Lãi/lỗ
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-2xl font-bold ${comparison.current.net >= 0 ? 'text-green-600' : 'text-red-500'}`}
                      >
                        {formatVND(comparison.current.net)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <PctBadge value={comparison.changes.net} />
                        <span className="text-xs text-muted-foreground">vs tháng trước</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Độ chính xác AI
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{comparison.currentStats.aiAccuracy}%</p>
                      <div className="flex items-center gap-1 mt-1">
                        <PctBadge value={comparison.changes.aiAccuracy} />
                        <span className="text-xs text-muted-foreground">vs tháng trước</span>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )
            )}
          </div>

          {/* Revenue vs Expense side-by-side chart */}
          {comparison && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  So sánh thu chi — Tháng {month} vs Tháng {prevMonth}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={[
                      {
                        name: `Tháng ${prevMonth}`,
                        revenue: comparison.previous.totalRevenue,
                        expense: comparison.previous.totalExpense,
                      },
                      {
                        name: `Tháng ${month}`,
                        revenue: comparison.current.totalRevenue,
                        expense: comparison.current.totalExpense,
                      },
                    ]}
                    barCategoryGap="35%"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v: number) => formatVNDAxis(v)}
                      tick={{ fontSize: 11 }}
                      width={80}
                    />
                    <Tooltip
                      formatter={(v) => (typeof v === 'number' ? formatVND(v) : String(v))}
                    />
                    <Bar dataKey="revenue" name="Doanh thu" fill="#16AB64" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Chi phí" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Top accounts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top 5 danh mục chi phí</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTop ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => `skel-exp-${i}`).map((k) => (
                      <Skeleton key={k} className="h-8" />
                    ))}
                  </div>
                ) : errorTop ? (
                  <ErrorRetryCard title="Không thể tải top chi phí" onRetry={() => refetchTop()} />
                ) : topAccounts?.topExpense.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-3">
                    {topAccounts?.topExpense.map((acc, i) => {
                      const max = topAccounts.topExpense[0]?.total ?? 1;
                      return (
                        <div key={acc.accountCode} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate max-w-[130px] sm:max-w-[200px]">
                              <Badge variant="outline" className="mr-1 text-xs">
                                {acc.accountCode}
                              </Badge>
                              {acc.accountName}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {formatVND(acc.total)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(acc.total / max) * 100}%`,
                                backgroundColor: COLORS[i],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Top 5 nguồn doanh thu</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTop ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }, (_, i) => `skel-rev-${i}`).map((k) => (
                      <Skeleton key={k} className="h-8" />
                    ))}
                  </div>
                ) : errorTop ? (
                  <ErrorRetryCard
                    title="Không thể tải top doanh thu"
                    onRetry={() => refetchTop()}
                  />
                ) : topAccounts?.topRevenue.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Chưa có dữ liệu</p>
                ) : (
                  <div className="space-y-3">
                    {topAccounts?.topRevenue.map((acc, i) => {
                      const max = topAccounts.topRevenue[0]?.total ?? 1;
                      return (
                        <div key={acc.accountCode} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium truncate max-w-[130px] sm:max-w-[200px]">
                              <Badge variant="outline" className="mr-1 text-xs">
                                {acc.accountCode}
                              </Badge>
                              {acc.accountName}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {formatVND(acc.total)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(acc.total / max) * 100}%`,
                                backgroundColor: COLORS[i],
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PlanGate>
    </div>
  );
}
