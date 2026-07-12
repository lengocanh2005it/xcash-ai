import { Brain, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { DashboardStatCard } from '@/components/dashboard/DashboardStatCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatVND } from '@/lib/format-vnd';
import type { SummaryData } from '@/types/api/reports';

interface ReportSummaryCardsProps {
  data: SummaryData | undefined;
  isLoading: boolean;
  isError: boolean;
  year: number;
  month: number;
  onRetry: () => void;
}

export function ReportSummaryCards({
  data,
  isLoading,
  isError,
  year,
  month,
  onRetry,
}: ReportSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(['revenue', 'expense', 'net', 'accuracy'] as const).map((k) => (
          <div key={k} className="h-[120px] w-full rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive/30 bg-destructive/5 py-6">
        <CardContent className="text-center">
          <p className="text-sm text-destructive">
            Không thể tải báo cáo tháng {month}/{year}
          </p>
          <Button variant="link" size="sm" className="mt-3" onClick={onRetry}>
            Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <DashboardStatCard
        label="Tổng thu"
        value={<span className="text-green-600">{formatVND(data.summary.totalRevenue)}</span>}
        icon={TrendingUp}
        footer={
          <p className="text-xs text-muted-foreground">
            Tổng phát sinh Có trên TK doanh thu (5xx) đã định khoản
          </p>
        }
      />
      <DashboardStatCard
        label="Tổng chi"
        value={<span className="text-red-600">{formatVND(data.summary.totalExpense)}</span>}
        icon={TrendingDown}
        footer={
          <p className="text-xs text-muted-foreground">
            Tổng phát sinh Nợ trên TK chi phí (6xx) đã định khoản
          </p>
        }
      />
      <DashboardStatCard
        label="Lãi/Lỗ"
        value={
          <span className={data.summary.net >= 0 ? 'text-green-600' : 'text-red-600'}>
            {formatVND(data.summary.net)}
          </span>
        }
        icon={Scale}
        footer={
          <p className="text-xs text-muted-foreground">Chênh lệch thu − chi trong tháng đã chọn</p>
        }
      />
      <DashboardStatCard
        label="Độ chính xác AI"
        value={`${data.stats.aiAccuracy}%`}
        icon={Brain}
        footer={
          <p className="text-xs text-muted-foreground">
            {data.stats.classifiedCount}/{data.stats.totalCount} giao dịch đã hoàn tất định khoản
          </p>
        }
      />
    </div>
  );
}
