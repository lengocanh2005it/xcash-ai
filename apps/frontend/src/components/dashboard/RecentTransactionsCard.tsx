import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
        <CardDescription>5 giao dịch mới nhất</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : !items.length ? (
          <p className="flex flex-1 items-center justify-center py-6 text-center text-sm text-muted-foreground">
            Chưa có giao dịch nào. Giao dịch sẽ xuất hiện sau khi Cas gửi webhook.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((txn) => (
              <div
                key={txn.id}
                className="rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium">{txn.transactionId}</p>
                  <p className="shrink-0 font-medium">
                    {Number(txn.amount).toLocaleString('vi-VN')}đ
                  </p>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {txn.content ?? '—'}
                </p>
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
