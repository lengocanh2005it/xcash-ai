import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { AuditLogItem } from '@/hooks/useAuditLog';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJsonBlock(value: Record<string, unknown> | null): string {
  if (!value || Object.keys(value).length === 0) {
    return '—';
  }
  return JSON.stringify(value, null, 2);
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

interface AuditLogDetailSheetProps {
  item: AuditLogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTenant?: boolean;
}

export function AuditLogDetailSheet({
  item,
  open,
  onOpenChange,
  showTenant = false,
}: AuditLogDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {item ? (
          <>
            <SheetHeader>
              <SheetTitle>Chi tiết nhật ký</SheetTitle>
              <SheetDescription>{formatDateTime(item.createdAt)}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 pr-2">
              <DetailRow label="Hành động">
                <Badge variant="secondary">{item.actionLabel}</Badge>
              </DetailRow>

              <DetailRow label="Người thực hiện">
                <p>{item.actorLabel}</p>
                {item.actor !== item.actorLabel && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                    {item.actor}
                  </p>
                )}
              </DetailRow>

              {showTenant && <DetailRow label="Doanh nghiệp">{item.businessName ?? '—'}</DetailRow>}

              <DetailRow label="Đối tượng">
                <p>{item.entityTypeLabel}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  {item.entityId}
                </p>
              </DetailRow>

              <DetailRow label="Trước thay đổi">
                <pre className="max-h-48 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
                  {formatJsonBlock(item.beforeState)}
                </pre>
              </DetailRow>

              <DetailRow label="Sau thay đổi">
                <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed whitespace-pre-wrap break-all">
                  {formatJsonBlock(item.afterState)}
                </pre>
              </DetailRow>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
