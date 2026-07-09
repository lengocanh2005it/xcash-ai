import type { SubscriptionPlan } from '@xcash/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND } from '@/lib/format-vnd';
import { formatCopilotQuota, PLAN_LABEL } from '@/lib/plan';
import { cn } from '@/lib/utils';
import type { BillingPlan } from '@/types/api/billing';
import { formatPlanQuotaSubtitle, getPlanFeatureLines } from './billing-constants';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePlans: BillingPlan[] | undefined;
  loadingPlans: boolean;
  selectedPlan: string | null;
  onSelectPlan: (plan: string) => void;
  onUpgrade: () => void;
  isPending: boolean;
  currentPlan: string | undefined;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  availablePlans,
  loadingPlans,
  selectedPlan,
  onSelectPlan,
  onUpgrade,
  isPending,
  currentPlan,
}: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  const isCurrent = currentPlan === plan;
                  const currentPlanItem = availablePlans?.find((p) => p.plan === currentPlan);
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
                      onClick={() => onSelectPlan(plan)}
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
                              f.inherited ? 'font-medium text-foreground' : 'text-muted-foreground',
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button disabled={!selectedPlan || isPending} onClick={onUpgrade}>
            {isPending ? 'Đang tạo đơn...' : 'Tiếp tục thanh toán'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
