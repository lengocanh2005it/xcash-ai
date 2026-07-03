import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiData } from '@/lib/api';
import { formatCurrency, formatTransactionDateTime } from '@/lib/dashboard-transactions';
import type { TransactionDetail, TransactionSummary } from '@/types/transaction';

interface TransactionDetailSheetProps {
  transaction: TransactionSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionDetailSheet({
  transaction,
  open,
  onOpenChange,
}: TransactionDetailSheetProps) {
  const transactionId = transaction?.id;

  const { data: detail, isLoading } = useQuery({
    queryKey: ['transactions', transactionId, 'detail'],
    queryFn: () => getApiData<TransactionDetail>(`/transactions/${transactionId}`),
    enabled: open && Boolean(transactionId),
  });

  const displayTxn = detail ?? transaction;
  const classification = detail?.classification ?? transaction?.classification;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Chi tiết giao dịch</SheetTitle>
          {displayTxn ? (
            <SheetDescription className="font-mono text-xs">
              {displayTxn.transactionId}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        {isLoading && !displayTxn ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : displayTxn ? (
          <div className="mt-4 space-y-6">
            <div>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(Number(displayTxn.amount))}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatTransactionDateTime(displayTxn.transactionDate)}
              </p>
              {displayTxn.senderAccount ? (
                <p className="mt-1 text-sm">{displayTxn.senderAccount}</p>
              ) : null}
              <div className="mt-2">
                <TransactionStatusBadge status={displayTxn.status} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">Nội dung giao dịch</p>
              <p className="mt-1 rounded-lg border bg-muted/30 p-3 text-sm">
                {displayTxn.content ? `"${displayTxn.content}"` : '—'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <p className="text-sm font-semibold">Định khoản AI</p>
              </div>

              {!classification ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có định khoản. AI sẽ xử lý giao dịch này sớm.
                </p>
              ) : (
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">TK Nợ</p>
                      <p className="mt-0.5 text-lg font-bold font-mono text-red-600">
                        {classification.debitAccount}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">TK Có</p>
                      <p className="mt-0.5 text-lg font-bold font-mono text-green-600">
                        {classification.creditAccount}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Phân loại</p>
                      <p className="text-sm">
                        {classification.classificationType === 'auto' ? 'Tự động (AI)' : 'Thủ công'}
                      </p>
                    </div>
                    <ConfidenceBadge score={classification.confidenceScore} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
