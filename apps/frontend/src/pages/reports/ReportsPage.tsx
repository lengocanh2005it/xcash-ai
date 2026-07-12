import { SubscriptionPlan } from '@xcash/shared-types';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { PaginationBar } from '@/components/shared/PaginationBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useReportsData } from '@/hooks/useReportsData';
import { hasPlanAccess, PLAN_LABEL } from '@/lib/plan';
import { AccountFilters } from './AccountFilters';
import { AccountTable } from './AccountTable';
import { ReportPeriodSelector } from './ReportPeriodSelector';
import { ReportSummaryCards } from './ReportSummaryCards';

export default function ReportsPage() {
  const { user } = useAuth();
  const canExport = hasPlanAccess(user?.plan, SubscriptionPlan.PRO);
  const requiredPlanLabel = PLAN_LABEL[SubscriptionPlan.PRO];

  const {
    year,
    month,
    yearOptions,
    data,
    isLoading,
    isError,
    refetch,
    accountItems,
    accountTotal,
    totalPages,
    hasAccountFilters,
    isSearchPending,
    loadingAccounts,
    fetchingAccounts,
    accountError,
    refetchAccounts,
    searchText,
    accountTypeFilter,
    debouncedSearch,
    page,
    setPage,
    setSearchText,
    setAccountTypeFilter,
    handleExport,
    clearAccountFilters,
    handlePeriodChange,
    PAGE_SIZE,
  } = useReportsData();

  return (
    <>
      <Header
        title="Báo cáo định khoản"
        description="Tổng hợp thu chi theo tài khoản TT133"
        actions={
          <ReportPeriodSelector
            year={year}
            month={month}
            yearOptions={yearOptions}
            canExport={canExport}
            requiredPlanLabel={requiredPlanLabel}
            isLoading={isLoading}
            onPeriodChange={handlePeriodChange}
            onExport={handleExport}
          />
        }
      />
      <div className="space-y-6 p-4 sm:p-6">
        <ReportSummaryCards
          data={data}
          isLoading={isLoading}
          isError={isError}
          year={year}
          month={month}
          onRetry={() => refetch()}
        />

        {data ? (
          <Card>
            <CardHeader className="space-y-4">
              <CardTitle>Chi tiết theo tài khoản</CardTitle>
              <AccountFilters
                searchText={searchText}
                accountTypeFilter={accountTypeFilter}
                debouncedSearch={debouncedSearch}
                hasAccountFilters={hasAccountFilters}
                isSearchPending={isSearchPending}
                onSearchChange={setSearchText}
                onTypeChange={(v) => {
                  setAccountTypeFilter(v);
                  setPage(1);
                }}
                onClear={clearAccountFilters}
              />
            </CardHeader>
            <CardContent>
              {loadingAccounts ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }, (_, i) => `skel-acc-${i}`).map((k) => (
                    <Skeleton key={k} className="h-10 w-full" />
                  ))}
                </div>
              ) : accountError ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-destructive">Không thể tải chi tiết theo tài khoản</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={() => refetchAccounts()}
                  >
                    Thử lại
                  </Button>
                </div>
              ) : !accountItems.length ? (
                <EmptyState
                  title={hasAccountFilters ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có dữ liệu'}
                  description={
                    hasAccountFilters
                      ? 'Thử đổi từ khóa hoặc bộ lọc khác'
                      : 'Chưa có giao dịch nào được định khoản trong tháng này'
                  }
                  action={
                    hasAccountFilters ? (
                      <Button variant="outline" size="sm" onClick={clearAccountFilters}>
                        Xóa bộ lọc
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <>
                  <AccountTable items={accountItems} />
                  {accountTotal > PAGE_SIZE ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          Hiển thị {accountItems.length} / {accountTotal} tài khoản
                        </p>
                        <PaginationBar
                          page={page}
                          totalPages={totalPages}
                          isFetching={fetchingAccounts}
                          onPageChange={(p) => setPage(p)}
                        />
                      </div>
                    </div>
                  ) : accountTotal > 0 ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                      {accountTotal} tài khoản có phát sinh trong tháng
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
