import { Bar, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { DebouncedResponsiveContainer } from '@/components/shared/DebouncedResponsiveContainer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type DailyTransactionTrendPoint, formatCurrency } from '@/lib/dashboard-transactions';
import { formatVNDAxis } from '@/lib/format-vnd';

interface CashflowTrendChartProps {
  data: DailyTransactionTrendPoint[];
  isLoading?: boolean;
}

function CashflowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="mb-1.5 font-medium">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <p key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span style={{ color: entry.color }}>{entry.name}</span>
            <span className="font-medium tabular-nums">
              {entry.dataKey === 'activityCount'
                ? `${entry.value} GD`
                : formatCurrency(entry.value)}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

export function CashflowTrendChart({ data, isLoading }: CashflowTrendChartProps) {
  const hasFlow = data.some((point) => point.revenueAmount > 0 || point.expenseAmount > 0);
  const hasActivity = data.some((point) => point.activityCount > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Thu chi & hoạt động 7 ngày qua</CardTitle>
        <CardDescription>
          Cột xanh = doanh thu, cột đỏ = chi phí (đã định khoản) · đường = số giao dịch/ngày
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : !hasFlow && !hasActivity ? (
          <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu thu chi. Biểu đồ sẽ hiện sau khi có giao dịch đã định khoản.
          </div>
        ) : (
          <DebouncedResponsiveContainer height={300}>
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <YAxis
                yAxisId="amount"
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={formatVNDAxis}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
              />
              <Tooltip content={<CashflowTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
              <Bar
                yAxisId="amount"
                dataKey="revenueAmount"
                name="Doanh thu"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Bar
                yAxisId="amount"
                dataKey="expenseAmount"
                name="Chi phí"
                fill="var(--chart-5)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="activityCount"
                name="Số GD"
                stroke="var(--chart-3)"
                strokeWidth={2}
                dot={{ fill: 'var(--chart-3)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </DebouncedResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
