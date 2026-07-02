import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TransactionStatusSlice } from '@/lib/dashboard-transactions';

interface TransactionStatusChartProps {
  data: TransactionStatusSlice[];
  isLoading?: boolean;
}

function StatusTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TransactionStatusSlice; value: number }>;
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

export function TransactionStatusChart({ data, isLoading }: TransactionStatusChartProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Trạng thái đối soát</CardTitle>
        <CardDescription>Phân bổ giao dịch theo trạng thái xử lý</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="mx-auto h-[240px] w-[240px] rounded-full" />
        ) : total === 0 ? (
          <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed bg-muted/30 px-4 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu trạng thái giao dịch.
          </div>
        ) : (
          <div className="space-y-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {data.map((slice) => (
                    <Cell key={slice.status} fill={slice.color} />
                  ))}
                </Pie>
                <Tooltip content={<StatusTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.map((slice) => (
                <div key={slice.status} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-muted-foreground">{slice.label}</span>
                  <span className="ml-auto font-medium">{slice.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
