import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatVND } from '@/lib/format-vnd';
import type { UpgradeResult } from '@/types/api/billing';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upgradeResult: UpgradeResult | null;
  onMockConfirm: () => void;
  isPending: boolean;
  isDev: boolean;
}

export function PaymentDialog({
  open,
  onOpenChange,
  upgradeResult,
  onMockConfirm,
  isPending,
  isDev,
}: PaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Thanh toán nâng cấp gói</DialogTitle>
        </DialogHeader>
        {upgradeResult && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Số tiền:{' '}
              <span className="font-semibold text-foreground">
                {formatVND(upgradeResult.amount)}
              </span>
            </p>

            {upgradeResult.qrCode ? (
              <div className="mx-auto w-fit rounded-lg border p-3">
                <QRCodeSVG value={upgradeResult.qrCode} size={176} />
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                {upgradeResult.isMock ? 'QR mock — chưa có PayOS key thật' : 'Đang tải QR...'}
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(upgradeResult.checkoutUrl, '_blank')}
            >
              Mở trang thanh toán PayOS
            </Button>

            <p className="text-xs text-muted-foreground">
              Hệ thống tự cập nhật sau khi thanh toán xong. Có thể đóng cửa sổ này rồi quay lại sau.
            </p>

            {isDev && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={isPending}
                onClick={onMockConfirm}
              >
                {isPending ? 'Đang xử lý...' : '🧪 Demo: Giả lập thanh toán thành công'}
              </Button>
            )}
          </div>
        )}
        <DialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Đóng — thanh toán sau
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
