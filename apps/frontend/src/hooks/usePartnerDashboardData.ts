import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { PLAN_LABELS, PLAN_ORDER } from '@/lib/plans';
import { PLAN_COLORS } from '@/pages/partner/DashboardChartComponents';
import type { DashboardStats, PartnerTenant, RevenueTrendPoint } from '@/types/partner';

export function computePlanDistribution(tenants: PartnerTenant[] | undefined) {
  const counts = new Map<string, number>();
  for (const t of tenants ?? []) {
    const key = t.plan ?? 'free';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return PLAN_ORDER.filter((plan) => (counts.get(plan) ?? 0) > 0).map((plan) => ({
    plan,
    label: PLAN_LABELS[plan] ?? plan,
    count: counts.get(plan) ?? 0,
    color: PLAN_COLORS[plan] ?? 'var(--chart-1)',
  }));
}

export function computePlanBreakdown(tenants: PartnerTenant[] | undefined) {
  const map = new Map<string, { count: number; activeCount: number; revenue: number }>();
  for (const t of tenants ?? []) {
    const key = t.plan ?? 'free';
    const cur = map.get(key) ?? { count: 0, activeCount: 0, revenue: 0 };
    const isActive = t.status === 'active';
    map.set(key, {
      count: cur.count + 1,
      activeCount: cur.activeCount + (isActive ? 1 : 0),
      revenue: cur.revenue + (isActive ? t.revenuePerMonth : 0),
    });
  }
  const total = tenants?.length ?? 0;
  return PLAN_ORDER.map((plan) => ({
    plan,
    label: PLAN_LABELS[plan] ?? plan,
    color: PLAN_COLORS[plan] ?? 'var(--chart-1)',
    count: map.get(plan)?.count ?? 0,
    activeCount: map.get(plan)?.activeCount ?? 0,
    revenue: map.get(plan)?.revenue ?? 0,
    pct: total > 0 ? Math.round(((map.get(plan)?.count ?? 0) / total) * 100) : 0,
  }));
}

export function computeMrr(planBreakdown: ReturnType<typeof computePlanBreakdown>) {
  return planBreakdown.reduce((sum, row) => sum + row.revenue, 0);
}

export function computeTopRevenue(tenants: PartnerTenant[] | undefined) {
  return [...(tenants ?? [])]
    .filter((t) => t.status === 'active' && t.revenuePerMonth > 0)
    .sort((a, b) => b.revenuePerMonth - a.revenuePerMonth)
    .slice(0, 5)
    .map((t) => ({
      name: t.businessName.length > 15 ? `${t.businessName.slice(0, 15)}…` : t.businessName,
      revenue: t.revenuePerMonth,
    }));
}

export function usePartnerDashboardData() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const hasDateFilter = fromDate !== '' || toDate !== '';

  const dateParams = {
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };

  const clearDateFilter = () => {
    setFromDate('');
    setToDate('');
  };

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['partner', 'stats', dateParams],
    queryFn: () =>
      api
        .get<{ data: DashboardStats }>('/partner/stats', { params: dateParams })
        .then((r) => r.data.data),
  });

  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ['partner', 'tenants'],
    queryFn: () =>
      api
        .get<{ data: { items: PartnerTenant[] } }>('/partner/tenants')
        .then((r) => r.data.data.items),
  });

  const { data: revenueTrend, isLoading: loadingTrend } = useQuery({
    queryKey: ['partner', 'revenue-trend', dateParams],
    queryFn: () =>
      api
        .get<{ data: RevenueTrendPoint[] }>('/partner/revenue-trend', { params: dateParams })
        .then((r) => r.data.data),
  });

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const { data: aiCosts, isLoading: loadingAiCosts } = useQuery({
    queryKey: ['partner', 'ai-costs', currentMonthStart],
    queryFn: () =>
      api
        .get<{ data: { grandTotalCostUsd: number } }>('/partner/ai-costs', {
          params: { fromDate: currentMonthStart },
        })
        .then((r) => r.data.data),
  });

  const planDistribution = useMemo(() => computePlanDistribution(tenants), [tenants]);
  const planBreakdown = useMemo(() => computePlanBreakdown(tenants), [tenants]);
  // MRR (doanh thu định kỳ) tính từ cùng nguồn `tenants` với breakdown bên dưới,
  // để card tổng và bảng phân bố không bao giờ lệch nhau.
  const mrr = useMemo(() => computeMrr(planBreakdown), [planBreakdown]);
  const topRevenue = useMemo(() => computeTopRevenue(tenants), [tenants]);

  return {
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    hasDateFilter,
    clearDateFilter,
    stats,
    loadingStats,
    tenants,
    loadingTenants,
    revenueTrend,
    loadingTrend,
    aiCosts,
    loadingAiCosts,
    planDistribution,
    planBreakdown,
    mrr,
    topRevenue,
  };
}
