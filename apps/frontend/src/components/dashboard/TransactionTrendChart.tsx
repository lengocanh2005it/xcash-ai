import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { type DailyTransactionTrendPoint, formatCurrency } from '@/lib/dashboard-transactions';

interface TransactionTrendChartProps {
  data: DailyTransactionTrendPoint[];
  isLoading?: boolean;
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyTransactionTrendPoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{point.count} giao dịch</p>
      <p className="text-primary">{formatCurrency(point.amount)}</p>
    </div>
  );
}

export function TransactionTrendChart({ data, isLoading }: TransactionTrendChartProps) {
  const hasData = data.some((point) => point.count > 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Giao dịch 7 ngày qua</CardTitle>
        <CardDescription>Số lượng và tổng tiền vào theo ngày</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !hasData ? (
          <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            Chưa có giao dịch. Biểu đồ sẽ hiện sau khi Cas gửi webhook.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="txnAmountFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              />
              <Tooltip content={<TrendTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#txnAmountFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
