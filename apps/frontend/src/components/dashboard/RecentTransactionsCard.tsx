import { TransactionStatus } from '@xcash/shared-types';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatTransactionTime } from '@/lib/dashboard-transactions';
import type { TransactionSummary } from '@/types/transaction';

interface RecentTransactionsCardProps {
  items: TransactionSummary[];
  isLoading?: boolean;
}

export function RecentTransactionsCard({ items, isLoading }: RecentTransactionsCardProps) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Giao dịch gần đây</CardTitle>
        <CardDescription>Cập nhật mỗi 10 giây</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : !items.length ? (
          <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
            Chưa có giao dịch nào hôm nay
          </p>
        ) : (
          <div className="divide-y">
            {items.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{txn.content ?? txn.transactionId}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatTransactionTime(txn.transactionDate)}
                    {txn.senderAccount ? ` • ${txn.senderAccount}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-semibold">
                    {Number(txn.amount).toLocaleString('vi-VN')}đ
                  </span>
                  <TransactionStatusBadge
                    status={txn.status}
                    className={
                      txn.status === TransactionStatus.REVIEW
                        ? 'border-amber-500/30 bg-amber-500/10'
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4">
          <Button asChild size="sm" variant="ghost" className="h-auto w-fit px-2">
            <Link to="/transactions">
              Xem tất cả
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
