import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { TransactionSourceBadge } from '@/components/shared/TransactionSourceBadge';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { formatTransactionTime } from '@/lib/date';
import { formatSignedTransactionAmount } from '@/lib/transaction-format';
import type { TransactionSummary } from '@/types/transaction';

interface TransactionCardListProps {
  items: TransactionSummary[];
  canBulkReclassify: boolean;
  selectedIds: Set<string>;
  toggleSelection: (txn: TransactionSummary, checked: boolean) => void;
  openDetail: (txn: TransactionSummary) => void;
}

export function TransactionCardList({
  items,
  canBulkReclassify,
  selectedIds,
  toggleSelection,
  openDetail,
}: TransactionCardListProps) {
  return (
    <div className="space-y-3 md:hidden">
      {items.map((txn) => {
        const selectable = canBulkReclassify && txn.status === 'pending';
        const checked = selectedIds.has(txn.id);

        return (
          <Card key={txn.id} className="py-4 transition-colors hover:bg-muted/30">
            <CardContent className="text-sm">
              <div className="flex items-start gap-3">
                {canBulkReclassify ? (
                  <Checkbox
                    checked={checked}
                    disabled={!selectable}
                    onCheckedChange={(value) => toggleSelection(txn, value === true)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Chọn giao dịch ${txn.transactionId}`}
                    className="mt-0.5"
                  />
                ) : null}
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openDetail(txn)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-xs text-muted-foreground">
                        {formatTransactionTime(txn.transactionDate)}
                      </p>
                      <TransactionSourceBadge source={txn.source} />
                    </div>
                    <TransactionStatusBadge status={txn.status} />
                  </div>
                  <p className="mt-2 font-semibold">
                    <span>{formatSignedTransactionAmount(Number(txn.amount))}</span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{txn.content ?? '—'}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {txn.senderAccount ?? 'Không rõ người gửi'}
                    </p>
                    <ConfidenceBadge
                      score={txn.classification?.confidenceScore ?? txn.confidenceScore}
                    />
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
