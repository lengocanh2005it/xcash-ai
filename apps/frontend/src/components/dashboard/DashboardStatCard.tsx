import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardStatCardProps {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function StatCardIconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon className="size-4" />
    </div>
  );
}

export function DashboardStatCard({
  label,
  value,
  footer,
  action,
  icon: Icon,
  className,
}: DashboardStatCardProps) {
  const headerAction = action ?? (Icon ? <StatCardIconBadge icon={Icon} /> : null);

  return (
    <Card className={cn('h-full gap-0 py-5', className)}>
      <CardHeader className="gap-1 px-5 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-lg">{value}</CardTitle>
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      </CardHeader>
      {footer ? <CardContent className="mt-auto px-5 pt-4">{footer}</CardContent> : null}
    </Card>
  );
}
