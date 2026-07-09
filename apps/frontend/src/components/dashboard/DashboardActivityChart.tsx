import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { DebouncedResponsiveContainer } from '@/components/shared/DebouncedResponsiveContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DailyTransactionTrendPoint } from '@/lib/dashboard-transactions';
import { cn } from '@/lib/utils';

interface DashboardActivityChartProps {
  data: DailyTransactionTrendPoint[];
  isLoading?: boolean;
  className?: string;
}

function ActivityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0]?.value ?? 0} giao dịch</p>
    </div>
  );
}

export function DashboardActivityChart({
  data,
  isLoading,
  className,
}: DashboardActivityChartProps) {
  const total = data.reduce((sum, point) => sum + point.activityCount, 0);
  const hasData = data.some((point) => point.activityCount > 0);

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Hoạt động 7 ngày</CardTitle>
            <CardDescription>Số giao dịch mỗi ngày (mọi trạng thái)</CardDescription>
          </div>
          {!isLoading && total > 0 ? (
            <span className="shrink-0 rounded-full border bg-muted/50 px-2.5 py-0.5 text-sm tabular-nums">
              <span className="font-semibold">{total}</span>
              <span className="ml-1 text-muted-foreground">GD</span>
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col pb-4">
        {isLoading ? (
          <Skeleton className="min-h-[200px] w-full flex-1" />
        ) : !hasData ? (
          <div className="flex min-h-[200px] flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            Chưa có giao dịch trong 7 ngày qua.
          </div>
        ) : (
          <DebouncedResponsiveContainer className="min-h-[200px] w-full flex-1" minHeight={200}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip content={<ActivityTooltip />} />
              <Area
                type="monotone"
                dataKey="activityCount"
                stroke="var(--chart-3)"
                strokeWidth={2}
                fill="url(#activityFill)"
                dot={{ fill: 'var(--chart-3)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </DebouncedResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
