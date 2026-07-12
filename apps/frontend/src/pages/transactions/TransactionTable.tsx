import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { TransactionSourceBadge } from '@/components/shared/TransactionSourceBadge';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatTransactionTime } from '@/lib/date';
import { formatSignedTransactionAmount } from '@/lib/transaction-format';
import type { TransactionSummary } from '@/types/transaction';

interface TransactionTableProps {
  items: TransactionSummary[];
  canBulkReclassify: boolean;
  selectedIds: Set<string>;
  allPendingOnPageSelected: boolean;
  pendingOnPage: TransactionSummary[];
  toggleSelection: (txn: TransactionSummary, checked: boolean) => void;
  toggleSelectAllPendingOnPage: (checked: boolean) => void;
  openDetail: (txn: TransactionSummary) => void;
}

export function TransactionTable({
  items,
  canBulkReclassify,
  selectedIds,
  allPendingOnPageSelected,
  pendingOnPage,
  toggleSelection,
  toggleSelectAllPendingOnPage,
  openDetail,
}: TransactionTableProps) {
  return (
    <div className="hidden overflow-hidden py-0 md:block">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            {canBulkReclassify ? (
              <TableHead className="w-10 py-3">
                <Checkbox
                  checked={allPendingOnPageSelected}
                  disabled={pendingOnPage.length === 0}
                  onCheckedChange={(value) => toggleSelectAllPendingOnPage(value === true)}
                  aria-label="Chọn tất cả giao dịch chờ xử lý trên trang"
                />
              </TableHead>
            ) : null}
            <TableHead className="py-3">Thời gian</TableHead>
            <TableHead className="py-3">Nguồn</TableHead>
            <TableHead className="py-3 text-right">Số tiền</TableHead>
            <TableHead className="py-3">Nội dung</TableHead>
            <TableHead className="py-3">Người gửi</TableHead>
            <TableHead className="py-3 text-center">TK Nợ/Có</TableHead>
            <TableHead className="py-3 text-center">Độ tin cậy</TableHead>
            <TableHead className="py-3 text-right">Trạng thái</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((txn) => {
            const selectable = canBulkReclassify && txn.status === 'pending';
            const checked = selectedIds.has(txn.id);

            return (
              <TableRow key={txn.id} className="cursor-pointer">
                {canBulkReclassify ? (
                  <TableCell className="w-10" onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={checked}
                      disabled={!selectable}
                      onCheckedChange={(value) => toggleSelection(txn, value === true)}
                      aria-label={`Chọn giao dịch ${txn.transactionId}`}
                    />
                  </TableCell>
                ) : null}
                <TableCell
                  className="text-sm text-muted-foreground whitespace-nowrap"
                  onClick={() => openDetail(txn)}
                >
                  {formatTransactionTime(txn.transactionDate)}
                </TableCell>
                <TableCell onClick={() => openDetail(txn)}>
                  <TransactionSourceBadge source={txn.source} />
                </TableCell>
                <TableCell className="text-right font-semibold" onClick={() => openDetail(txn)}>
                  {formatSignedTransactionAmount(Number(txn.amount))}
                </TableCell>
                <TableCell
                  className="max-w-[260px] truncate text-sm"
                  onClick={() => openDetail(txn)}
                >
                  {txn.content ?? '—'}
                </TableCell>
                <TableCell className="text-sm" onClick={() => openDetail(txn)}>
                  {txn.senderAccount ?? '—'}
                </TableCell>
                <TableCell
                  className="text-center font-mono text-xs"
                  onClick={() => openDetail(txn)}
                >
                  {txn.classification ? (
                    <span>
                      {txn.classification.debitAccount}/{txn.classification.creditAccount}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center" onClick={() => openDetail(txn)}>
                  <ConfidenceBadge
                    score={txn.classification?.confidenceScore ?? txn.confidenceScore}
                  />
                </TableCell>
                <TableCell className="text-right" onClick={() => openDetail(txn)}>
                  <div className="flex justify-end">
                    <TransactionStatusBadge status={txn.status} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
