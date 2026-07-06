import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { SignedTransactionAmount } from '@/components/shared/SignedTransactionAmount';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiData, postApiData } from '@/lib/api';
import { formatTransactionDateTime } from '@/lib/dashboard-transactions';
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
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useQuery({
    queryKey: ['transactions', transactionId, 'detail'],
    queryFn: () => getApiData<TransactionDetail>(`/transactions/${transactionId}`),
    enabled: open && Boolean(transactionId),
    // AI định khoản bất đồng bộ qua hàng đợi → poll khi còn 'pending' để tự cập nhật UI.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2500 : false),
  });

  const displayTxn = detail ?? transaction;
  const classification = detail?.classification ?? transaction?.classification;
  const isPending = displayTxn?.status === 'pending';

  const reclassifyMutation = useMutation({
    mutationFn: () => postApiData(`/transactions/${transactionId}/reclassify`),
    onSuccess: () => {
      toast.success('Đã gửi yêu cầu — AI sẽ định khoản trong giây lát');
      queryClient.invalidateQueries({ queryKey: ['transactions', transactionId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: () => toast.error('Không thể gửi yêu cầu định khoản lại'),
  });

  // Đang chờ AI: vừa gửi yêu cầu (hoặc đang gửi) và giao dịch vẫn còn pending.
  const waitingForAi = (reclassifyMutation.isPending || reclassifyMutation.isSuccess) && isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Chi tiết giao dịch</SheetTitle>
          {displayTxn ? (
            <SheetDescription
              className="truncate font-mono text-xs"
              title={displayTxn.transactionId}
            >
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
              <p className="text-2xl font-bold">
                <SignedTransactionAmount amount={Number(displayTxn.amount)} />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatTransactionDateTime(displayTxn.transactionDate)}
              </p>
              {displayTxn.senderAccount ? (
                <p className="mt-1 text-sm">{displayTxn.senderAccount}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <TransactionStatusBadge status={displayTxn.status} />
                {displayTxn.source === 'import' && (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  >
                    Import Excel
                  </Badge>
                )}
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
                <div className="space-y-3">
                  {isPending && waitingForAi ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      AI đang định khoản, vui lòng đợi trong giây lát…
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {isPending
                          ? 'Giao dịch đang chờ AI định khoản. Bấm nút bên dưới để yêu cầu AI xử lý ngay.'
                          : 'Chưa có định khoản cho giao dịch này.'}
                      </p>
                      {isPending ? (
                        <Button
                          size="sm"
                          onClick={() => reclassifyMutation.mutate()}
                          disabled={reclassifyMutation.isPending}
                        >
                          {reclassifyMutation.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Sparkles className="size-4" />
                          )}
                          Cho AI định khoản lại
                        </Button>
                      ) : null}
                    </>
                  )}
                </div>
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
                  {classification.reason && (
                    <div className="border-t pt-3">
                      <p className="text-xs text-muted-foreground mb-1">Lý do AI</p>
                      <p className="text-sm text-muted-foreground italic">
                        {classification.reason}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
