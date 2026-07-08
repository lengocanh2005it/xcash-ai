import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionPlan } from '@xcash/shared-types';
import { AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/date';
import { formatVND } from '@/lib/format-vnd';
import { formatCopilotQuota, PLAN_LABEL } from '@/lib/plan';
import { canViewBilling, isAdmin } from '@/lib/rbac';
import { cn } from '@/lib/utils';
import type {
  BillingPlan,
  OverageOrder,
  OveragePaymentResult,
  PlanData,
  UpgradeResult,
} from '@/types/api/billing';
import {
  formatPlanQuotaSubtitle,
  getPlanFeatureLines,
  PLAN_ORDER,
} from './billing/billing-constants';
import { CycleTransactionsDialog } from './billing/CycleTransactionsDialog';
import { PaymentHistoryTable } from './billing/PaymentHistoryTable';

export function BillingTab() {
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

  if (isLoading) return <Skeleton className="h-48" />;

  const usedPct = data
    ? Math.min(100, Math.round((data.transactionUsed / data.transactionQuota) * 100))
    : 0;
  const isNearLimit = usedPct >= 80;

  const copilotUnlimited = data?.copilotQuota === -1;
  const copilotUsedPct =
    data && !copilotUnlimited
      ? Math.min(100, Math.round((data.copilotUsed / data.copilotQuota) * 100))
      : 0;
  const copilotNearLimit = copilotUsedPct >= 80;
  const copilotExceeded = copilotUsedPct >= 100;

  const isDev = import.meta.env.DEV;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Gói dịch vụ</CardTitle>
              <CardDescription>Gói hiện tại và usage của doanh nghiệp</CardDescription>
            </div>
            {data &&
              (data.plan === PLAN_ORDER[PLAN_ORDER.length - 1] ? (
                <Button size="sm" variant="outline" disabled>
                  Đã dùng gói cao nhất
                </Button>
              ) : isAdminUser ? (
                <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                  Nâng cấp gói
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <Button size="sm" disabled className="pointer-events-none">
                        Nâng cấp gói
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Chỉ chủ doanh nghiệp mới có thể nâng cấp gói</TooltipContent>
                </Tooltip>
              ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={data.plan === 'free' ? 'secondary' : 'default'}
                    className="uppercase"
                  >
                    {PLAN_LABEL[data.plan as SubscriptionPlan] ?? data.plan}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {data.pricePerMonth > 0 ? `${formatVND(data.pricePerMonth)}/tháng` : 'Miễn phí'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Hết chu kỳ: {formatDateVN(data.currentCycleEnd)}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Giao dịch đã dùng</span>
                  <span className={cn('font-medium', isNearLimit && 'text-destructive')}>
                    {data.transactionUsed.toLocaleString()} /{' '}
                    {data.transactionQuota.toLocaleString()}
                  </span>
                </div>
                <Progress value={usedPct} className={cn(isNearLimit && '[&>div]:bg-destructive')} />
                {isNearLimit && (
                  <p className="text-xs text-destructive">
                    Sắp đạt giới hạn. Nâng cấp gói để tiếp tục nhận giao dịch.
                  </p>
                )}
                {data.transactionUsed > 0 &&
                  data.usageBreakdown &&
                  (data.usageBreakdown.fromBank > 0 || data.usageBreakdown.fromImport > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block size-2 rounded-full bg-primary" />
                        Ngân hàng: {data.usageBreakdown.fromBank.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block size-2 rounded-full bg-amber-500" />
                        Import Excel: {data.usageBreakdown.fromImport.toLocaleString()}
                      </span>
                    </div>
                  )}
                {data.transactionUsed > 0 && (
                  <button
                    type="button"
                    onClick={() => setCycleDetailOpen(true)}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Xem chi tiết giao dịch trong chu kỳ →
                  </button>
                )}
              </div>

              {!copilotUnlimited && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lượt chat Copilot</span>
                    <span
                      className={cn(
                        'font-medium',
                        copilotExceeded
                          ? 'text-destructive'
                          : copilotNearLimit
                            ? 'text-orange-500'
                            : undefined,
                      )}
                    >
                      {data.copilotUsed.toLocaleString()} / {data.copilotQuota.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={copilotUsedPct}
                    className={cn(
                      copilotExceeded
                        ? '[&>div]:bg-destructive'
                        : copilotNearLimit
                          ? '[&>div]:bg-orange-500'
                          : undefined,
                    )}
                  />
                  {copilotExceeded && (
                    <p className="text-xs text-destructive">
                      Đã dùng hết lượt chat Copilot. Nâng cấp gói để tiếp tục.
                    </p>
                  )}
                  {copilotNearLimit && !copilotExceeded && (
                    <p className="text-xs text-orange-500">
                      Sắp hết lượt chat Copilot trong chu kỳ này.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PaymentHistoryTable />

      {pendingOverage && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Có phí vượt quota chưa thanh toán
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Số tiền cần thanh toán:{' '}
              <span className="font-semibold">{formatVND(pendingOverage.amount)}</span>. Vui lòng
              thanh toán để tránh gián đoạn dịch vụ.
            </p>
          </div>
          {isAdminUser ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
              disabled={overageOrderMutation.isPending}
              onClick={() => overageOrderMutation.mutate()}
            >
              Thanh toán ngay
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-not-allowed">
                  <Button
                    size="sm"
                    variant="outline"
                    className="pointer-events-none shrink-0 border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300"
                    disabled
                  >
                    Thanh toán ngay
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Chỉ chủ doanh nghiệp mới có thể thanh toán</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Dialog chọn gói */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="flex max-h-[min(88dvh,100%)] w-[min(42rem,calc(100vw-2.5rem))] max-w-2xl flex-col gap-0 overflow-hidden px-5 py-5 top-[6dvh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] sm:px-6 sm:py-6">
          <DialogHeader className="shrink-0 pb-3 pr-8">
            <DialogTitle>Chọn gói dịch vụ</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-2">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {loadingPlans
                ? Array.from({ length: 4 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                    <Skeleton key={i} className="h-48 w-full rounded-xl" />
                  ))
                : (availablePlans ?? []).map((planItem) => {
                    const plan = planItem.plan;
                    const isCurrent = data?.plan === plan;
                    const currentPlanItem = availablePlans?.find((p) => p.plan === data?.plan);
                    const isLower =
                      !isCurrent &&
                      currentPlanItem != null &&
                      planItem.pricePerMonth < currentPlanItem.pricePerMonth;
                    const isDisabled = isCurrent || isLower;
                    const isSelected = selectedPlan === plan;
                    return (
                      <button
                        key={plan}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedPlan(plan)}
                        className={cn(
                          'w-full min-w-0 rounded-xl border p-4 text-left transition-all',
                          isDisabled
                            ? 'cursor-not-allowed border-primary/40 bg-primary/5 opacity-60'
                            : isSelected
                              ? 'border-primary ring-1 ring-primary'
                              : 'hover:border-primary/50',
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <span className="font-semibold">
                            {PLAN_LABEL[plan as SubscriptionPlan] ?? plan}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              Hiện tại
                            </Badge>
                          )}
                          {isLower && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] text-muted-foreground"
                            >
                              Không khả dụng
                            </Badge>
                          )}
                        </div>
                        <p className="mb-2 text-lg font-bold text-primary break-words">
                          {planItem.pricePerMonth === 0
                            ? 'Miễn phí'
                            : `${formatVND(planItem.pricePerMonth)}/tháng`}
                        </p>
                        <div className="mb-2 space-y-0.5 text-xs text-muted-foreground break-words">
                          <p>{formatPlanQuotaSubtitle(planItem)}</p>
                          <p>{formatCopilotQuota(planItem.copilotQuota, plan)}</p>
                        </div>
                        <ul className="space-y-1">
                          {getPlanFeatureLines(plan).map((f) => (
                            <li
                              key={f.text}
                              className={cn(
                                'flex items-start gap-1.5 text-xs break-words',
                                f.inherited
                                  ? 'font-medium text-foreground'
                                  : 'text-muted-foreground',
                              )}
                            >
                              <span className="shrink-0 text-primary">✓</span>
                              <span>{f.text}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
            </div>
          </div>
          <DialogFooter className="mt-4 shrink-0 gap-2.5 border-t border-border pt-4 sm:gap-2">
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={!selectedPlan || upgradeMutation.isPending}
              onClick={() => selectedPlan && upgradeMutation.mutate(selectedPlan)}
            >
              {upgradeMutation.isPending ? 'Đang tạo đơn...' : 'Tiếp tục thanh toán'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog thanh toán */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent
          className="max-w-sm"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Thanh toán nâng cấp gói</DialogTitle>
          </DialogHeader>
          {upgradeResult && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Số tiền:{' '}
                <span className="font-semibold text-foreground">
                  {formatVND(upgradeResult.amount)}
                </span>
              </p>

              {upgradeResult.qrCode ? (
                <div className="mx-auto w-fit rounded-lg border p-3">
                  <QRCodeSVG value={upgradeResult.qrCode} size={176} />
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                  {upgradeResult.isMock ? 'QR mock — chưa có PayOS key thật' : 'Đang tải QR...'}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(upgradeResult.checkoutUrl, '_blank')}
              >
                Mở trang thanh toán PayOS
              </Button>

              <p className="text-xs text-muted-foreground">
                Hệ thống tự cập nhật sau khi thanh toán xong. Có thể đóng cửa sổ này rồi quay lại
                sau.
              </p>

              {isDev && (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={mockConfirmMutation.isPending}
                  onClick={() => mockConfirmMutation.mutate(upgradeResult.orderCode)}
                >
                  {mockConfirmMutation.isPending
                    ? 'Đang xử lý...'
                    : '🧪 Demo: Giả lập thanh toán thành công'}
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPaymentOpen(false)}
            >
              Đóng — thanh toán sau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog thanh toán phí vượt quota */}
      <Dialog open={overagePaymentOpen} onOpenChange={setOveragePaymentOpen}>
        <DialogContent
          className="max-w-sm"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Thanh toán phí vượt quota</DialogTitle>
          </DialogHeader>
          {overageResult && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Số giao dịch vượt:{' '}
                <span className="font-semibold text-foreground">
                  {overageResult.overageCount} GD
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Số tiền:{' '}
                <span className="font-semibold text-foreground">
                  {formatVND(overageResult.amount)}
                </span>
              </p>

              {overageResult.qrCode ? (
                <div className="mx-auto w-fit rounded-lg border p-3">
                  <QRCodeSVG value={overageResult.qrCode} size={176} />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                  {overageResult.isMock ? 'QR mock — chưa có PayOS key thật' : 'Đang tải QR...'}
                </div>
              )}

              {overageResult.checkoutUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(overageResult.checkoutUrl!, '_blank')}
                >
                  Mở trang thanh toán PayOS
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                Hệ thống tự cập nhật sau khi thanh toán xong.
              </p>

              {isDev && (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={mockConfirmOverageMutation.isPending}
                  onClick={() => mockConfirmOverageMutation.mutate(overageResult.orderCode)}
                >
                  {mockConfirmOverageMutation.isPending
                    ? 'Đang xử lý...'
                    : '🧪 Demo: Giả lập thanh toán thành công'}
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOveragePaymentOpen(false)}
            >
              Đóng — thanh toán sau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {data && (
        <CycleTransactionsDialog
          open={cycleDetailOpen}
          onOpenChange={setCycleDetailOpen}
          cycleStart={data.currentCycleStart}
          cycleEnd={data.currentCycleEnd}
        />
      )}
    </div>
  );
}
