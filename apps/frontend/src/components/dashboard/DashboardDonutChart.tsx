import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { DebouncedResponsiveContainer } from '@/components/shared/DebouncedResponsiveContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { DonutSlice } from '@/lib/dashboard-transactions';

interface DashboardDonutChartProps {
  title: string;
  description: string;
  data: DonutSlice[];
  isLoading?: boolean;
  emptyMessage: string;
}

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DonutSlice; value: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const slice = payload[0]?.payload;
  if (!slice) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{slice.label}</p>
      <p className="text-muted-foreground">{slice.value} giao dịch</p>
    </div>
  );
}

function LegendRows({ data, total }: { data: DonutSlice[]; total: number }) {
  return (
    <div className="flex w-full flex-col justify-center gap-1.5">
      {data.map((slice) => {
        const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
        return (
          <div
            key={slice.id}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2.5 py-1.5 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate text-muted-foreground">{slice.label}</span>
            </div>
            <span className="shrink-0 text-xs tabular-nums">
              <span className="font-medium text-foreground">{slice.value}</span>
              <span className="ml-1 text-muted-foreground">({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardDonutChart({
  title,
  description,
  data,
  isLoading,
  emptyMessage,
}: DashboardDonutChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        {isLoading ? (
          <div className="grid items-center gap-4 sm:grid-cols-[132px_1fr]">
            <Skeleton className="mx-auto aspect-square w-full max-w-[132px] rounded-full sm:mx-0" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-[80%]" />
            </div>
          </div>
        ) : total === 0 ? (
          <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <div className="grid items-center gap-4 sm:grid-cols-[132px_1fr]">
            <div className="relative mx-auto aspect-square w-full max-w-[132px] sm:mx-0">
              <DebouncedResponsiveContainer className="h-full w-full" minHeight={100}>
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="label"
                    innerRadius="56%"
                    outerRadius="88%"
                    paddingAngle={3}
                    stroke="var(--background)"
                    strokeWidth={2}
                  >
                    {data.map((slice) => (
                      <Cell key={slice.id} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </DebouncedResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold tabular-nums leading-none">
                  {total}
                  <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">GD</span>
                </span>
              </div>
            </div>
            <LegendRows data={data} total={total} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
