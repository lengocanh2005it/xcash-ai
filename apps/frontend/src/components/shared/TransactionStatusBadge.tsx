import { TransactionStatus } from '@xcash/shared-types';
import { Badge } from '@/components/ui/badge';
import { TRANSACTION_STATUS_LABELS } from '@/lib/dashboard-transactions';
import { cn } from '@/lib/utils';

interface TransactionStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_VARIANTS: Record<TransactionStatus, 'secondary' | 'success' | 'warning' | 'outline'> =
  {
    [TransactionStatus.PENDING]: 'secondary',
    [TransactionStatus.CLASSIFIED]: 'success',
    [TransactionStatus.REVIEW]: 'warning',
    [TransactionStatus.SKIPPED]: 'outline',
  };

export function TransactionStatusBadge({ status, className }: TransactionStatusBadgeProps) {
  const normalized = status as TransactionStatus;
  const label = TRANSACTION_STATUS_LABELS[normalized] ?? status;
  const variant = STATUS_VARIANTS[normalized] ?? 'secondary';

  return (
    <Badge variant={variant} className={cn(className)}>
      {label}
    </Badge>
  );
}
