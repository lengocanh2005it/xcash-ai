import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ErrorRetryCardProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorRetryCard({
  title = 'Không thể tải dữ liệu',
  description,
  onRetry,
  className,
}: ErrorRetryCardProps) {
  return (
    <Card className={cn('border-destructive/30 bg-destructive/5', className)}>
      <CardContent className="py-6 text-center">
        <AlertCircle className="mx-auto mb-2 size-5 text-destructive" />
        <p className="text-sm text-destructive">{title}</p>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        {onRetry && (
          <Button variant="link" size="sm" className="mt-2" onClick={onRetry}>
            Thử lại
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
