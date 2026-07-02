import { SensitiveField } from '@/components/shared/SensitiveField';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { maskAccountNumber, maskPersonName } from '@/lib/mask-sensitive';
import type { OnboardingGrant } from '@/types/onboarding';

interface BankAccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grants: OnboardingGrant[];
}

function formatLinkedAt(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BankAccountDetailsDialog({
  open,
  onOpenChange,
  grants,
}: BankAccountDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thông tin tài khoản ngân hàng</DialogTitle>
          <DialogDescription>
            Chi tiết tài khoản đã liên kết qua Cas Link. Bấm biểu tượng mắt để hiện/ẩn dữ liệu nhạy
            cảm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {grants.map((grant) => (
            <div key={grant.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {grant.bankLogo ? (
                    <img
                      src={grant.bankLogo}
                      alt={grant.bankName ?? 'Ngân hàng'}
                      className="size-6 shrink-0 rounded-full object-contain"
                      loading="lazy"
                    />
                  ) : null}
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    {grant.bankName ?? 'Ngân hàng'}
                  </Badge>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  Liên kết {formatLinkedAt(grant.linkedAt)}
                </span>
              </div>

              <SensitiveField
                label="Số tài khoản"
                value={grant.accountNumber}
                maskedValue={maskAccountNumber(grant.accountNumber)}
                emptyText="Chưa có từ Cas"
              />
              <SensitiveField
                label="Chủ tài khoản"
                value={grant.accountHolderName}
                maskedValue={maskPersonName(grant.accountHolderName)}
                emptyText="Chưa có từ Cas"
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
