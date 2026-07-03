import type { SubscriptionPlan } from '@xcash/shared-types';
import { Lock, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { hasPlanAccess, PLAN_LABEL } from '@/lib/plan';

interface PlanGateProps {
  /** Gói tối thiểu để dùng tính năng. */
  minPlan: SubscriptionPlan;
  /** Tên tính năng hiển thị trong thông báo khóa. */
  featureName: string;
  children: ReactNode;
}

/**
 * Bọc nội dung tính năng theo gói. Nếu gói hiện tại chưa đủ, hiển thị lớp phủ
 * khóa + nút nâng cấp thay vì nội dung thật.
 */
export function PlanGate({ minPlan, featureName, children }: PlanGateProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (hasPlanAccess(user?.plan, minPlan)) {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 select-none blur-sm" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-lg">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-6 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            Tính năng {featureName} bị khóa
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Tính năng này chỉ khả dụng từ gói{' '}
            <span className="font-semibold text-foreground">{PLAN_LABEL[minPlan]}</span> trở lên.
            Nâng cấp gói dịch vụ để mở khóa.
          </p>
          <Button
            className="mt-5 gap-2"
            onClick={() => navigate('/settings?tab=billing&upgrade=1')}
          >
            <Sparkles className="size-4" />
            Nâng cấp gói dịch vụ
          </Button>
        </div>
      </div>
    </div>
  );
}
