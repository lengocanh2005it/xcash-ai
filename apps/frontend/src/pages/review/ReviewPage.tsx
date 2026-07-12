import { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useReviewQueue } from '@/hooks/useReviewQueue';
import { canManageTransactions } from '@/lib/rbac';
import type { ClassificationItem } from '@/types/api/review';
import { CorrectDialog } from './CorrectDialog';
import { ReviewCardList } from './ReviewCardList';
import { ReviewFilters } from './ReviewFilters';
import { ReviewTable } from './ReviewTable';

export default function ReviewPage() {
  const { user } = useAuth();
  const canReview = canManageTransactions(user?.role);

  const {
    data,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    isLoading,
    totalPages,
    hasActiveFilters,
    isSearchPending,
    confirmMutation,
    correctMutation,
    skipMutation,
    PAGE_SIZE,
  } = useReviewQueue();

  const [correctDialog, setCorrectDialog] = useState<ClassificationItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ClassificationItem | null>(null);
  const [skipTarget, setSkipTarget] = useState<ClassificationItem | null>(null);

  const isAnyPending = confirmMutation.isPending || skipMutation.isPending;

  const openCorrect = (item: ClassificationItem) => setCorrectDialog(item);

  return (
    <>
      <Header
        title="Human Review"
        description="Xem xét và xác nhận các định khoản AI chưa tự tin (dưới 85%)"
      />
      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>
              Hàng chờ review
              {data ? (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({data.total} mục)
                </span>
              ) : null}
            </CardTitle>
            <ReviewFilters
              search={filters.search}
              confidence={filters.confidence}
              debouncedSearch={debouncedFilters.search}
              debouncedConfidence={debouncedFilters.confidence}
              isSearchPending={isSearchPending}
              hasActiveFilters={hasActiveFilters}
              onSearchChange={(v) => setFilter('search', v)}
              onConfidenceChange={(v) => setFilter('confidence', v)}
              onClear={() => resetFilters()}
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : !data?.items.length ? (
              <EmptyState
                title={
                  hasActiveFilters
                    ? 'Không tìm thấy giao dịch phù hợp'
                    : 'Không có giao dịch cần review'
                }
                description={
                  hasActiveFilters
                    ? 'Thử đổi từ khóa hoặc bộ lọc độ tin cậy.'
                    : 'AI đã tự tin phân loại tất cả giao dịch. Làm tốt lắm!'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={() => resetFilters()}>
                      Xóa bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ReviewCardList
                  items={data.items}
                  canReview={canReview}
                  isPending={isAnyPending}
                  onConfirm={setConfirmTarget}
                  onCorrect={openCorrect}
                  onSkip={setSkipTarget}
                />
                <ReviewTable
                  items={data.items}
                  canReview={canReview}
                  isPending={isAnyPending}
                  onConfirm={setConfirmTarget}
                  onCorrect={openCorrect}
                  onSkip={setSkipTarget}
                />
                {data ? (
                  <div className="mt-4 border-t pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        Hiển thị {data.items.length} / {data.total} mục
                      </p>
                      {data.total > PAGE_SIZE ? (
                        <PaginationBar
                          page={page}
                          totalPages={totalPages}
                          onPageChange={(p) => setPage(p)}
                        />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <CorrectDialog
          item={correctDialog}
          onClose={() => setCorrectDialog(null)}
          onConfirm={(id, d, c) => correctMutation.mutate({ id, d, c })}
          isPending={correctMutation.isPending}
        />

        <ConfirmDialog
          open={confirmTarget !== null}
          onOpenChange={(open) => !open && setConfirmTarget(null)}
          title="Xác nhận định khoản này?"
          description={
            confirmTarget
              ? `Định khoản ${confirmTarget.debitAccount}/${confirmTarget.creditAccount} cho giao dịch "${confirmTarget.transaction.content ?? 'Không có nội dung'}" sẽ được ghi nhận.`
              : ''
          }
          confirmLabel="Xác nhận"
          loading={confirmMutation.isPending}
          onConfirm={() => {
            if (confirmTarget) confirmMutation.mutate(confirmTarget.id);
          }}
        />

        <ConfirmDialog
          open={skipTarget !== null}
          onOpenChange={(open) => !open && setSkipTarget(null)}
          title="Bỏ qua giao dịch này?"
          description={
            skipTarget
              ? `Giao dịch "${skipTarget.transaction.content ?? 'Không có nội dung'}" sẽ được đánh dấu bỏ qua và không định khoản.`
              : ''
          }
          confirmLabel="Bỏ qua"
          variant="destructive"
          loading={skipMutation.isPending}
          onConfirm={() => {
            if (skipTarget) skipMutation.mutate(skipTarget.id);
          }}
        />
      </div>
    </>
  );
}
