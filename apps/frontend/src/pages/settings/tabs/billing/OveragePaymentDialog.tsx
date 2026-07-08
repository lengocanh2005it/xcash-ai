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
import type { OveragePaymentResult } from '@/types/api/billing';

interface OveragePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overageResult: OveragePaymentResult | null;
  onMockConfirm: () => void;
  isPending: boolean;
  isDev: boolean;
}

export function OveragePaymentDialog({
  open,
  onOpenChange,
  overageResult,
  onMockConfirm,
  isPending,
  isDev,
}: OveragePaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Thanh toán phí vượt quota</DialogTitle>
        </DialogHeader>
        {overageResult && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Số giao dịch vượt:{' '}
              <span className="font-semibold text-foreground">{overageResult.overageCount} GD</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Số tiền:{' '}
              <span className="font-semibold text-foreground">
                {formatVND(overageResult.amount)}
              </span>
            </p>

            {overageResult.qrCode ? (
              <div className="mx-auto w-fit rounded-lg border p-3">
                <QRCodeSVG value={overageResult.qrCode} size={176} />
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                {overageResult.isMock ? 'QR mock — chưa có PayOS key thật' : 'Đang tải QR...'}
              </div>
            )}

            {overageResult.checkoutUrl && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(overageResult.checkoutUrl!, '_blank')}
              >
                Mở trang thanh toán PayOS
              </Button>
            )}

            <p className="text-xs text-muted-foreground">
              Hệ thống tự cập nhật sau khi thanh toán xong.
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
