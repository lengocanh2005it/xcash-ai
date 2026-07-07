import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PlanData {
  copilotQuota: number;
  copilotUsed: number;
}

interface Props {
  variant?: 'sidebar' | 'card';
}

export function CopilotQuotaSummary({ variant = 'sidebar' }: Props) {
  const { data: planData, isLoading } = useQuery<PlanData>({
    queryKey: ['billing', 'current-plan'],
    queryFn: () => api.get<{ data: PlanData }>('/billing/current-plan').then((r) => r.data.data),
    staleTime: 60_000,
    select: (d) => ({ copilotQuota: d.copilotQuota, copilotUsed: d.copilotUsed }),
  });

  if (isLoading && variant === 'card') {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }

  if (!planData) return null;

  const quota = planData.copilotQuota;
  const used = planData.copilotUsed;
  const isUnlimited = quota === -1;

  if (variant === 'sidebar' && (isUnlimited || quota <= 0)) return null;

  const remaining = isUnlimited ? null : Math.max(0, quota - used);
  const pct = isUnlimited ? 0 : quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 100;
  const nearLimit = !isUnlimited && pct >= 80;
  const exceeded = !isUnlimited && pct >= 100;

  const statusClass = exceeded
    ? 'text-destructive'
    : nearLimit
      ? 'text-orange-500'
      : 'text-foreground';

  if (variant === 'card') {
    return (
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Lượt gửi câu hỏi trong chu kỳ</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Mỗi lần bạn gửi câu hỏi mới tính 1 lượt. Cột «Tin nhắn» bên dưới đếm cả câu hỏi và trả
              lời AI trong từng cuộc chat — không cộng lại để so với số lượt đã dùng.
            </p>
          </div>
          {isUnlimited ? (
            <span className="text-sm font-medium text-primary">Không giới hạn</span>
          ) : (
            <span className={cn('text-sm font-medium tabular-nums', statusClass)}>
              {used.toLocaleString('vi-VN')} / {quota.toLocaleString('vi-VN')}
            </span>
          )}
        </div>

        {!isUnlimited && quota > 0 && (
          <>
            <Progress
              value={pct}
              className={cn(
                'h-2',
                exceeded
                  ? '[&>div]:bg-destructive'
                  : nearLimit
                    ? '[&>div]:bg-orange-500'
                    : undefined,
              )}
            />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Đã gửi: </span>
                <span className="font-medium tabular-nums">{used.toLocaleString('vi-VN')}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Còn lại: </span>
                <span className={cn('font-medium tabular-nums', statusClass)}>
                  {remaining?.toLocaleString('vi-VN')}
                </span>
              </p>
            </div>
            {exceeded && (
              <p className="text-xs text-destructive">
                Đã dùng hết lượt chat Copilot trong chu kỳ này.
              </p>
            )}
            {nearLimit && !exceeded && (
              <p className="text-xs text-orange-500">Sắp hết lượt chat Copilot trong chu kỳ này.</p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-sidebar-border/80 px-4 py-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
        <span>Lượt gửi câu hỏi</span>
        <span className={cn('tabular-nums', statusClass)}>
          {used}/{quota}
        </span>
      </div>
      <Progress
        value={pct}
        className={cn(
          'h-1.5',
          exceeded ? '[&>div]:bg-destructive' : nearLimit ? '[&>div]:bg-orange-500' : '',
        )}
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Còn lại{' '}
        <span className={cn('font-medium tabular-nums', statusClass)}>
          {remaining?.toLocaleString('vi-VN')}
        </span>{' '}
        lượt gửi câu hỏi
      </p>
    </div>
  );
}
