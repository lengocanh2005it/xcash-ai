import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionPlan } from '@xcash/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { PLAN_LABEL } from '@/lib/plan';
import { canViewBilling, isAdmin } from '@/lib/rbac';
import type {
  BillingPlan,
  OverageOrder,
  OveragePaymentResult,
  PlanData,
  UpgradeResult,
} from '@/types/api/billing';

export function useBillingTab() {
  const qc = useQueryClient();
  const { refreshSession, updateUser, user } = useAuth();
  const canAccessBilling = canViewBilling(user?.role);
  const isAdminUser = isAdmin(user?.role);

  const syncPlanFromBilling = useCallback(
    async (plan: string) => {
      updateUser({ plan: plan as SubscriptionPlan });
      await refreshSession();
    },
    [refreshSession, updateUser],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [overagePaymentOpen, setOveragePaymentOpen] = useState(false);
  const [overageResult, setOverageResult] = useState<OveragePaymentResult | null>(null);
  const [cycleDetailOpen, setCycleDetailOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgrade') === '1') {
      setUpgradeOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('upgrade');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'current-plan'],
    queryFn: () => api.get<{ data: PlanData }>('/billing/current-plan').then((r) => r.data.data),
    enabled: canAccessBilling,
    refetchInterval: paymentOpen ? 5_000 : false,
  });

  const { data: availablePlans, isLoading: loadingPlans } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<{ data: BillingPlan[] }>('/billing/plans').then((r) => r.data.data),
    enabled: upgradeOpen && canAccessBilling,
  });

  const { data: overageOrders } = useQuery({
    queryKey: ['billing', 'overage-orders'],
    queryFn: () =>
      api.get<{ data: OverageOrder[] }>('/billing/overage-orders').then((r) => r.data.data),
    enabled: canAccessBilling && isAdminUser,
    refetchInterval: overagePaymentOpen ? 5_000 : 30_000,
  });

  const pendingOverage = overageOrders?.[0] ?? null;

  const overageOrderMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: OveragePaymentResult }>('/billing/overage-order').then((r) => r.data.data),
    onSuccess: (result) => {
      setOverageResult(result);
      setOveragePaymentOpen(true);
    },
    onError: () => toast.error('Không thể tạo đơn thanh toán phí vượt quota'),
  });

  const mockConfirmOverageMutation = useMutation({
    mutationFn: (orderCode: string) => api.post(`/billing/overage-order/${orderCode}/mock-confirm`),
    onSuccess: () => {
      setOveragePaymentOpen(false);
      setOverageResult(null);
      qc.invalidateQueries({ queryKey: ['billing', 'overage-orders'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Demo: Đã thanh toán phí vượt quota!');
    },
    onError: () => toast.error('Không thể xác nhận mock'),
  });

  useEffect(() => {
    if (!data?.plan || data.plan === user?.plan) return;
    updateUser({ plan: data.plan as SubscriptionPlan });
  }, [data?.plan, updateUser, user?.plan]);

  const prevPlanRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!paymentOpen || !upgradeResult || !data) return;
    if (prevPlanRef.current && data.plan === upgradeResult?.orderCode) return;
    if (data.plan !== prevPlanRef.current && prevPlanRef.current !== undefined) {
      setPaymentOpen(false);
      setUpgradeResult(null);
      setSelectedPlan(null);
      toast.success(
        `Nâng cấp lên gói ${PLAN_LABEL[data.plan as SubscriptionPlan] ?? data.plan} thành công!`,
      );
      qc.invalidateQueries({ queryKey: ['billing', 'current-plan'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      void syncPlanFromBilling(data.plan);
    }
    prevPlanRef.current = data.plan;
  }, [data, paymentOpen, upgradeResult, qc, syncPlanFromBilling]);

  useEffect(() => {
    if (data && !paymentOpen) prevPlanRef.current = data.plan;
  }, [data, paymentOpen]);

  const upgradeMutation = useMutation({
    mutationFn: (targetPlan: string) =>
      api
        .post<{ data: UpgradeResult }>('/billing/upgrade', { targetPlan })
        .then((r) => r.data.data),
    onSuccess: (result) => {
      setUpgradeResult(result);
      setUpgradeOpen(false);
      setPaymentOpen(true);
      prevPlanRef.current = data?.plan;
    },
    onError: () => toast.error('Không thể tạo đơn thanh toán, vui lòng thử lại'),
  });

  const mockConfirmMutation = useMutation({
    mutationFn: (orderCode: string) => api.post(`/billing/upgrade/${orderCode}/mock-confirm`),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['billing', 'current-plan'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setPaymentOpen(false);
      setUpgradeResult(null);
      setSelectedPlan(null);
      toast.success('Demo: Thanh toán thành công!');
      const refreshed = await qc.fetchQuery({
        queryKey: ['billing', 'current-plan'],
        queryFn: () =>
          api.get<{ data: PlanData }>('/billing/current-plan').then((r) => r.data.data),
      });
      if (refreshed?.plan) {
        await syncPlanFromBilling(refreshed.plan);
      } else {
        await refreshSession();
      }
    },
    onError: () => toast.error('Không thể xác nhận mock'),
  });

  return {
    data,
    isLoading,
    canAccessBilling,
    isAdminUser,
    user,
    upgradeOpen,
    setUpgradeOpen,
    paymentOpen,
    setPaymentOpen,
    upgradeResult,
    setUpgradeResult,
    selectedPlan,
    setSelectedPlan,
    overagePaymentOpen,
    setOveragePaymentOpen,
    overageResult,
    setOverageResult,
    cycleDetailOpen,
    setCycleDetailOpen,
    availablePlans,
    loadingPlans,
    pendingOverage,
    overageOrderMutation,
    mockConfirmOverageMutation,
    upgradeMutation,
    mockConfirmMutation,
  };
}
