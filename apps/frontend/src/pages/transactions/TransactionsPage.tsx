import { FileSpreadsheet, Receipt } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTransactionsList } from '@/hooks/useTransactionsList';
import { ImportTransactionsDialog } from './ImportTransactionsDialog';
import { TransactionBulkBar } from './TransactionBulkBar';
import { TransactionCardList } from './TransactionCardList';
import { TransactionDetailSheet } from './TransactionDetailSheet';
import { TransactionFilters } from './TransactionFilters';
import { TransactionTable } from './TransactionTable';

export default function TransactionsPage() {
  const {
    items,
    data,
    totalPages,
    filters,
    debouncedFilters,
    setFilter,
    page,
    setPage,
    isLoading,
    isError,
    isFetching,
    refetch,
    hasActiveFilters,
    canBulkReclassify,
    canImport,
    selectedIds,
    pendingOnPage,
    selectedPendingCount,
    allPendingOnPageSelected,
    bulkReclassifyMutation,
    toggleSelection,
    toggleSelectAllPendingOnPage,
    handleBulkReclassify,
    importDialogOpen,
    setImportDialogOpen,
    selectedTxn,
    sheetOpen,
    setSheetOpen,
    bulkConfirmOpen,
    setBulkConfirmOpen,
    openDetail,
    clearFilters,
  } = useTransactionsList();

  const isSearchPending = filters.search !== debouncedFilters.search;

  return (
    <>
      <Header
        title="Giao dịch"
        description="Danh sách giao dịch ngân hàng nhận qua Cas Balance Hook"
        actions={
          <div className="flex items-center gap-2">
            {canImport && (
              <Button size="sm" onClick={() => setImportDialogOpen(true)}>
                <FileSpreadsheet className="mr-2 size-4" />
                Nhập từ Excel
              </Button>
            )}
            <Button variant="link" size="sm" onClick={() => refetch()} disabled={isFetching}>
              Làm mới
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <TransactionFilters
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          isSearchPending={isSearchPending}
          onFilterChange={(key, value) => setFilter(key as never, value as never)}
          onClearFilters={clearFilters}
        />

        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : isError ? (
          <Card className="border-destructive/30 bg-destructive/5 py-6">
            <CardContent className="text-center">
              <p className="text-sm text-destructive">Không thể tải danh sách giao dịch</p>
              <Button variant="link" size="sm" className="mt-3" onClick={() => refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        ) : !items.length ? (
          <Card className="py-4">
            <CardContent>
              <EmptyState
                className="border-0 bg-transparent py-6"
                icon={Receipt}
                title="Không tìm thấy giao dịch nào"
                description={
                  hasActiveFilters
                    ? 'Thử đổi bộ lọc hoặc xóa điều kiện tìm kiếm.'
                    : 'Giao dịch sẽ xuất hiện khi Cas gửi webhook sau khi liên kết ngân hàng.'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {canBulkReclassify && selectedIds.size > 0 ? (
              <TransactionBulkBar
                selectedCount={selectedIds.size}
                selectedPendingCount={selectedPendingCount}
                isPending={bulkReclassifyMutation.isPending}
                onClearSelection={() => {}}
                onBulkReclassify={() => setBulkConfirmOpen(true)}
              />
            ) : null}

            <TransactionCardList
              items={items}
              canBulkReclassify={canBulkReclassify}
              selectedIds={selectedIds}
              toggleSelection={toggleSelection}
              openDetail={openDetail}
            />

            <TransactionTable
              items={items}
              canBulkReclassify={canBulkReclassify}
              selectedIds={selectedIds}
              allPendingOnPageSelected={allPendingOnPageSelected}
              pendingOnPage={pendingOnPage}
              toggleSelection={toggleSelection}
              toggleSelectAllPendingOnPage={toggleSelectAllPendingOnPage}
              openDetail={openDetail}
            />

            {data ? (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {items.length} / {data.total} giao dịch
                </p>
                {data.total > 20 ? (
                  <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                  />
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <TransactionDetailSheet
        transaction={selectedTxn}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <ImportTransactionsDialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) refetch();
        }}
        onImported={() => {
          setFilter('source', 'import');
        }}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onOpenChange={setBulkConfirmOpen}
        title="Định khoản lại hàng loạt?"
        description={`Gửi ${selectedPendingCount} giao dịch đang chờ xử lý cho AI định khoản lại. Thao tác này có thể mất vài phút tùy số lượng.`}
        confirmLabel="Gửi cho AI"
        loading={bulkReclassifyMutation.isPending}
        onConfirm={handleBulkReclassify}
      />
    </>
  );
}
