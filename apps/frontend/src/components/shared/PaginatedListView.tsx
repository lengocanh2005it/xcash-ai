import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { ErrorRetryCard } from './ErrorRetryCard';
import { PaginationBar } from './PaginationBar';
import { TableSkeleton } from './TableSkeleton';

interface PaginatedListViewProps<T> {
  items: T[];
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  refetch?: () => void;
  skeletonRows?: number;
  skeletonColumns?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  hasActiveFilters?: boolean;
  clearFilters?: () => void;
  renderMobileItem: (item: T, index: number) => ReactNode;
  renderDesktopHeader?: () => ReactNode;
  renderDesktopRow: (item: T, index: number) => ReactNode;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    label: string;
    onPageChange: (page: number) => void;
    isFetching?: boolean;
    compact?: boolean;
  };
  children?: ReactNode;
}

export function PaginatedListView<T>({
  items,
  isLoading = false,
  isError = false,
  error,
  refetch,
  skeletonRows = 5,
  skeletonColumns = 6,
  emptyTitle = 'Chưa có dữ liệu',
  emptyDescription,
  hasActiveFilters = false,
  clearFilters,
  renderMobileItem,
  renderDesktopHeader,
  renderDesktopRow,
  pagination,
  children,
}: PaginatedListViewProps<T>) {
  if (isLoading) {
    return <TableSkeleton rows={skeletonRows} columns={skeletonColumns} />;
  }

  if (isError) {
    return (
      <ErrorRetryCard
        title="Không thể tải dữ liệu"
        description={error?.message}
        onRetry={refetch}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? 'Không tìm thấy kết quả' : emptyTitle}
        description={
          hasActiveFilters ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : emptyDescription
        }
        action={
          hasActiveFilters && clearFilters ? (
            <button
              type="button"
              className="text-sm text-primary underline underline-offset-4 hover:opacity-80"
              onClick={clearFilters}
            >
              Xóa bộ lọc
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {children}

      {/* Mobile card layout */}
      <div className="space-y-3 lg:hidden">
        {items.map((item, index) => renderMobileItem(item, index))}
      </div>

      {/* Desktop table layout */}
      <div className="hidden lg:block">
        <table className="w-full caption-bottom text-sm">
          {renderDesktopHeader ? (
            <thead className="[&_tr]:border-b">{renderDesktopHeader()}</thead>
          ) : null}
          <tbody className="[&_tr:last-child]:border-0">
            {items.map((item, index) => renderDesktopRow(item, index))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-4 border-t pt-4">
          <PaginationBar
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            label={pagination.label}
            isFetching={pagination.isFetching}
            compact={pagination.compact}
            onPageChange={pagination.onPageChange}
          />
        </div>
      ) : null}
    </>
  );
}
