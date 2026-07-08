import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CopilotConfirmActionCardData } from '@xcash/shared-types';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getApiData, postApiData } from '@/lib/api';

interface ClassificationStatus {
  status: string;
}

export function CopilotActionCard({ actionCard }: { actionCard: CopilotConfirmActionCardData }) {
  const queryClient = useQueryClient();

  const { data: liveStatus, isLoading: checking } = useQuery({
    queryKey: ['copilot-action-card-status', actionCard.transactionId],
    queryFn: () =>
      getApiData<ClassificationStatus>(`/transactions/${actionCard.transactionId}/classification`),
    enabled: actionCard.status !== 'not_found',
  });

  const status = liveStatus?.status ?? actionCard.status;

  const { mutate: confirm, isPending: confirming } = useMutation({
    mutationFn: () =>
      postApiData<void>(`/review/${actionCard.classificationId}/confirm`, { source: 'copilot' }),
    onSuccess: () => {
      toast.success('Đã xác nhận định khoản');
      queryClient.invalidateQueries({ queryKey: ['review-queue'] });
      queryClient.invalidateQueries({ queryKey: ['review', 'count'] });
      queryClient.invalidateQueries({
        queryKey: ['copilot-action-card-status', actionCard.transactionId],
      });
    },
    onError: () => toast.error('Có lỗi xảy ra, vui lòng thử lại'),
  });

  const canConfirmNow = actionCard.canConfirm && status === 'review' && !checking;

  if (status === 'not_found') {
    return (
      <div className="mt-2 max-w-sm rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
        <span className="font-medium">Đề xuất xác nhận giao dịch</span>
        <p className="text-xs text-muted-foreground">{actionCard.reason}</p>
      </div>
    );
  }

  return (
    <div className="mt-2 max-w-sm rounded-lg border bg-muted/40 p-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Đề xuất xác nhận giao dịch</span>
        <Badge variant="secondary" className="text-xs font-normal">
          {actionCard.confidence}% tin cậy
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs line-clamp-2">{actionCard.content}</p>
      <div className="flex items-center gap-2 text-xs">
        <span>
          Nợ <b>{actionCard.debitAccount}</b>
        </span>
        <span>
          Có <b>{actionCard.creditAccount}</b>
        </span>
        <span className="ml-auto">{Math.abs(actionCard.amount).toLocaleString('vi-VN')}đ</span>
      </div>

      {status !== 'review' ? (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 className="size-3.5" />
          Giao dịch này đã được xác nhận
        </div>
      ) : !actionCard.canConfirm ? (
        <p className="text-xs text-muted-foreground">{actionCard.reason}</p>
      ) : (
        <Button size="sm" disabled={!canConfirmNow || confirming} onClick={() => confirm()}>
          {confirming || checking ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Xác nhận
        </Button>
      )}
    </div>
  );
}
