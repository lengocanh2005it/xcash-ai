import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TransactionSource = 'cas' | 'import';

interface TransactionSourceBadgeProps {
  source?: TransactionSource | string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export function TransactionSourceBadge({
  source = 'cas',
  className,
  size = 'sm',
}: TransactionSourceBadgeProps) {
  const isImport = source === 'import';

  return (
    <Badge
      variant="outline"
      className={cn(
        size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0 text-[11px] font-medium',
        isImport
          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
          : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
        className,
      )}
    >
      {isImport ? 'Import Excel' : 'Ngân hàng'}
    </Badge>
  );
}
