import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SensitiveFieldProps {
  label: string;
  value: string | null | undefined;
  maskedValue: string;
  emptyText?: string;
  className?: string;
}

export function SensitiveField({
  label,
  value,
  maskedValue,
  emptyText = 'Chưa có thông tin',
  className,
}: SensitiveFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const hasValue = Boolean(value?.trim());
  const displayValue = !hasValue ? emptyText : revealed ? value : maskedValue;

  return (
    <div className={cn('flex items-start justify-between gap-2', className)}>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{displayValue}</p>
      </div>
      {hasValue ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground"
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          title={revealed ? 'Ẩn' : 'Hiện'}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      ) : null}
    </div>
  );
}
