import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ACCOUNT_CODE_PATTERN } from '@/hooks/useReviewQueue';
import type { ClassificationItem } from '@/types/api/review';

interface CorrectDialogProps {
  item: ClassificationItem | null;
  onClose: () => void;
  onConfirm: (id: string, debitAccount: string, creditAccount: string) => void;
  isPending: boolean;
}

export function CorrectDialog({ item, onClose, onConfirm, isPending }: CorrectDialogProps) {
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');

  const open = (classification: ClassificationItem) => {
    setDebitAccount(classification.debitAccount);
    setCreditAccount(classification.creditAccount);
  };

  if (item) {
    open(item);
  }

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa định khoản</DialogTitle>
        </DialogHeader>
        {item ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{item.transaction.content}</p>
            {item.reason ? (
              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                AI: {item.reason}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>TK Nợ</Label>
                <Input
                  value={debitAccount}
                  onChange={(e) => setDebitAccount(e.target.value)}
                  placeholder="vd: 112"
                />
              </div>
              <div className="space-y-2">
                <Label>TK Có</Label>
                <Input
                  value={creditAccount}
                  onChange={(e) => setCreditAccount(e.target.value)}
                  placeholder="vd: 511"
                />
              </div>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={() => {
              if (!item) return;
              if (
                !ACCOUNT_CODE_PATTERN.test(debitAccount) ||
                !ACCOUNT_CODE_PATTERN.test(creditAccount)
              ) {
                toast.error('Mã tài khoản phải có 3–4 chữ số');
                return;
              }
              onConfirm(item.id, debitAccount, creditAccount);
            }}
            disabled={isPending || !debitAccount || !creditAccount}
          >
            Xác nhận sửa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
