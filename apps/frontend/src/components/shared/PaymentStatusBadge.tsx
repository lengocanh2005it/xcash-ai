import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PaymentStatus = 'paid' | 'pending' | 'failed' | 'expired' | 'active' | 'suspended';

interface PaymentStatusBadgeProps {
  status: PaymentStatus | string;
  className?: string;
}

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Đã thanh toán',
  pending: 'Chờ thanh toán',
  failed: 'Thất bại',
  expired: 'Hết hạn',
  active: 'Hoạt động',
  suspended: 'Đã khóa',
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  pending:
    'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  failed:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  expired: 'bg-muted text-muted-foreground border-border',
  active:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
};

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const normalized = (status as PaymentStatus) ?? 'pending';
  const label = PAYMENT_STATUS_LABELS[normalized] ?? status;
  const styles = PAYMENT_STATUS_STYLES[normalized] ?? PAYMENT_STATUS_STYLES.pending;

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', styles, className)}>
      {label}
    </Badge>
  );
}
