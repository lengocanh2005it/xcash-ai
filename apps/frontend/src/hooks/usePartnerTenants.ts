import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { useFilteredPagination } from '@/hooks/useFilteredPagination';
import { api } from '@/lib/api';
import { PLAN_LABELS } from '@/lib/plans';
import type {
  PartnerTenant,
  PartnerTenantsResponse,
  PlanPricingItem,
  TenantDetail,
  TenantStats,
} from '@/types/partner';

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 20;

export function usePartnerTenants() {
  const queryClient = useQueryClient();
  const [viewingTenantId, setViewingTenantId] = useState<string | null>(null);
  const [tenantAction, setTenantAction] = useState<{
    type: 'suspend' | 'activate';
    tenant: PartnerTenant;
  } | null>(null);
  const [setPlanTarget, setSetPlanTarget] = useState<PartnerTenant | null>(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string>('');
  const [confirmSetPlan, setConfirmSetPlan] = useState(false);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['partner', 'stats'],
    queryFn: () => api.get<{ data: TenantStats }>('/partner/stats').then((r) => r.data.data),
  });

  const {
    data: tenantsData,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading: loadingTenants,
    isError: tenantsError,
    refetch: refetchTenants,
  } = useFilteredPagination({
    queryKey: ['partner', 'tenants'],
    queryFn: ({ filters, page }) =>
      api
        .get<{ data: PartnerTenantsResponse }>('/partner/tenants', {
          params: {
            page,
            limit: PAGE_SIZE,
            search: filters.search.trim() || undefined,
            status: filters.status,
            plan: filters.plan,
          },
        })
        .then((r) => r.data.data),
    defaultFilters: { search: '', status: 'all', plan: 'all' },
    debounceMs: SEARCH_DEBOUNCE_MS,
    keepPrevious: true,
  });

  const filteredTenants = tenantsData?.items ?? [];
  const totalPages = tenantsData ? Math.max(1, tenantsData.totalPages) : 1;

  const { data: planPricing } = useQuery({
    queryKey: ['partner', 'plan-pricing'],
    queryFn: () =>
      api.get<{ data: PlanPricingItem[] }>('/partner/plan-pricing').then((r) => r.data.data),
  });

  const { data: tenantDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['partner', 'tenant-detail', viewingTenantId],
    queryFn: () =>
      api
        .get<{ data: TenantDetail }>(`/partner/tenants/${viewingTenantId}`)
        .then((r) => r.data.data),
    enabled: viewingTenantId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['partner', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['partner', 'tenants'] });
  };

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/partner/tenants/${id}/suspend`),
    onSuccess: () => {
      toast.success('Đã khóa tài khoản doanh nghiệp');
      setTenantAction(null);
      invalidate();
    },
    onError: () => toast.error('Không thể khóa tài khoản'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/partner/tenants/${id}/activate`),
    onSuccess: () => {
      toast.success('Đã mở khóa tài khoản doanh nghiệp');
      setTenantAction(null);
      invalidate();
    },
    onError: () => toast.error('Không thể mở khóa tài khoản'),
  });

  const setPlanMutation = useMutation({
    mutationFn: ({ id, targetPlan }: { id: string; targetPlan: string }) =>
      api.patch(`/partner/tenants/${id}/plan`, { targetPlan }),
    onSuccess: () => {
      toast.success(
        `Đã chuyển "${setPlanTarget?.businessName}" sang gói ${PLAN_LABELS[selectedNewPlan] ?? selectedNewPlan}`,
      );
      setConfirmSetPlan(false);
      setSetPlanTarget(null);
      setSelectedNewPlan('');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['partner', 'tenant-detail'] });
    },
    onError: () => toast.error('Không thể đổi gói dịch vụ'),
  });

  const hasActiveFilters =
    debouncedFilters.search.trim() !== '' ||
    debouncedFilters.status !== 'all' ||
    debouncedFilters.plan !== 'all';
  const isSearchPending = filters.search !== debouncedFilters.search;

  return {
    stats,
    loadingStats,
    filteredTenants,
    totalPages,
    tenantsData,
    loadingTenants,
    tenantsError,
    refetchTenants,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    hasActiveFilters,
    isSearchPending,
    planPricing,
    viewingTenantId,
    setViewingTenantId,
    tenantDetail,
    loadingDetail,
    tenantAction,
    setTenantAction,
    setPlanTarget,
    setSetPlanTarget,
    selectedNewPlan,
    setSelectedNewPlan,
    confirmSetPlan,
    setConfirmSetPlan,
    suspendMutation,
    activateMutation,
    setPlanMutation,
  };
}
