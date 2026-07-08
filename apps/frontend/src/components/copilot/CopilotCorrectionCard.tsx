import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CopilotCorrectActionCardData } from '@xcash/shared-types';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiData, postApiData } from '@/lib/api';

interface ClassificationStatus {
  status: string;
}

export function CopilotCorrectionCard({
  actionCard,
}: {
  actionCard: CopilotCorrectActionCardData;
}) {
  const queryClient = useQueryClient();

  const { data: liveStatus, isLoading: checking } = useQuery({
    queryKey: ['copilot-action-card-status', actionCard.transactionId],
    queryFn: () =>
      getApiData<ClassificationStatus>(`/transactions/${actionCard.transactionId}/classification`),
    enabled: actionCard.status !== 'not_found',
  });

  const status = liveStatus?.status ?? actionCard.status;

  const { mutate: correct, isPending: correcting } = useMutation({
    mutationFn: () =>
      postApiData<void>(`/review/${actionCard.classificationId}/correct`, {
        debitAccount: actionCard.proposedDebitAccount,
        creditAccount: actionCard.proposedCreditAccount,
        source: 'copilot',
      }),
    onSuccess: () => {
      toast.success('Đã sửa định khoản');
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'count'] });
      queryClient.invalidateQueries({
        queryKey: ['copilot-action-card-status', actionCard.transactionId],
      });
    },
    onError: () => toast.error('Có lỗi xảy ra, vui lòng thử lại'),
  });

  const canCorrectNow = actionCard.canCorrect && status === 'review' && !checking;

  if (status === 'not_found') {
    return (
      <div className="mt-2 max-w-sm rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
        <span className="font-medium">Đề xuất sửa định khoản</span>
        <p className="text-xs text-muted-foreground">{actionCard.reason}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-sm rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Đề xuất sửa định khoản</span>
        <Badge variant="secondary" className="text-xs font-normal">
          {actionCard.confidence}% tin cậy
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs line-clamp-2">{actionCard.content}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground line-through">
          Nợ {actionCard.debitAccount} / Có {actionCard.creditAccount}
        </span>
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
        <span className="font-medium">
          Nợ {actionCard.proposedDebitAccount} / Có {actionCard.proposedCreditAccount}
        </span>
        <span className="ml-auto">{Math.abs(actionCard.amount).toLocaleString('vi-VN')}đ</span>
      </div>

      {status !== 'review' ? (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 className="size-3.5" />
          Giao dịch này đã được xử lý
        </div>
      ) : !actionCard.canCorrect ? (
        <p className="text-xs text-muted-foreground">{actionCard.reason}</p>
      ) : (
        <Button size="sm" disabled={!canCorrectNow || correcting} onClick={() => correct()}>
          {correcting || checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Sửa định khoản
        </Button>
      )}
    </div>
  );
}
