import { CheckCircle, Pencil, SkipForward } from 'lucide-react';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { CopyIdButton } from '@/components/shared/CopyIdButton';
import { Button } from '@/components/ui/button';
import { formatDateVN } from '@/lib/date';
import type { ClassificationItem } from '@/types/api/review';

function formatAmount(amount: string | number) {
  return Number(amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

interface ReviewTableProps {
  items: ClassificationItem[];
  canReview: boolean;
  isPending: boolean;
  onConfirm: (item: ClassificationItem) => void;
  onCorrect: (item: ClassificationItem) => void;
  onSkip: (item: ClassificationItem) => void;
}

export function ReviewTable({
  items,
  canReview,
  isPending,
  onConfirm,
  onCorrect,
  onSkip,
}: ReviewTableProps) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 pr-4 font-medium">Mã GD</th>
            <th className="pb-3 pr-4 font-medium">Ngày</th>
            <th className="pb-3 pr-4 font-medium">Nội dung</th>
            <th className="pb-3 pr-4 font-medium">Số tiền</th>
            <th className="pb-3 pr-4 font-medium">TK Nợ</th>
            <th className="pb-3 pr-4 font-medium">TK Có</th>
            <th className="pb-3 pr-4 font-medium">Độ tin cậy</th>
            {canReview ? <th className="pb-3 font-medium">Hành động</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-muted/30">
              <td className="py-3 pr-4">
                <CopyIdButton id={item.transaction.id} />
              </td>
              <td className="py-3 pr-4 text-muted-foreground">
                {formatDateVN(item.transaction.transactionDate)}
              </td>
              <td
                className="max-w-[250px] truncate py-3 pr-4"
                title={item.transaction.content ?? ''}
              >
                {item.transaction.content ?? '—'}
              </td>
              <td className="py-3 pr-4 font-mono">{formatAmount(item.transaction.amount)}</td>
              <td className="py-3 pr-4 font-mono font-medium">{item.debitAccount}</td>
              <td className="py-3 pr-4 font-mono font-medium">{item.creditAccount}</td>
              <td className="py-3 pr-4">
                <ConfidenceBadge score={item.confidenceScore} />
              </td>
              {canReview ? (
                <td className="py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Xác nhận"
                      aria-label="Xác nhận định khoản"
                      onClick={() => onConfirm(item)}
                      disabled={isPending}
                    >
                      <CheckCircle className="size-4 text-green-600" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Sửa"
                      aria-label="Sửa định khoản"
                      onClick={() => onCorrect(item)}
                    >
                      <Pencil className="size-4 text-blue-600" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Bỏ qua"
                      aria-label="Bỏ qua giao dịch"
                      onClick={() => onSkip(item)}
                      disabled={isPending}
                    >
                      <SkipForward className="size-4 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
