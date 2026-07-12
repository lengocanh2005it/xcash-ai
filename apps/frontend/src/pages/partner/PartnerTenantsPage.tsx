import { Building2, CheckCircle, Eye, Search, Settings2, Wallet, XCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PaginatedListView } from '@/components/shared/PaginatedListView';
import { PaymentStatusBadge } from '@/components/shared/PaymentStatusBadge';
import { SummaryCard } from '@/components/shared/SummaryCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePartnerTenants } from '@/hooks/usePartnerTenants';
import { formatVND } from '@/lib/format-vnd';
import { PLAN_LABELS } from '@/lib/plans';
import { SetPlanDialog } from './SetPlanDialog';
import { TenantDetailDialog } from './TenantDetailDialog';

type Tenant =
  ReturnType<typeof usePartnerTenants> extends { filteredTenants: (infer T)[] } ? T : never;

export default function PartnerTenantsPage() {
  const {
    stats,
    loadingStats,
    filteredTenants,
    totalPages,
    tenantsData,
    loadingTenants,
    tenantsError,
    refetchTenants,
    filters,
    debouncedFilters,
    setFilter,
    resetFilters,
    page,
    setPage,
    hasActiveFilters,
    isSearchPending,
    planPricing,
    viewingTenantId,
    setViewingTenantId,
    tenantDetail,
    loadingDetail,
    tenantAction,
    setTenantAction,
    setPlanTarget,
    setSetPlanTarget,
    selectedNewPlan,
    setSelectedNewPlan,
    confirmSetPlan,
    setConfirmSetPlan,
    suspendMutation,
    activateMutation,
    setPlanMutation,
  } = usePartnerTenants();

  const clearFilters = () => resetFilters();

  return (
    <>
      <Header
        title="Doanh nghiệp"
        description="Quản lý toàn bộ doanh nghiệp đang sử dụng X-Cash AI"
      />

      <div className="space-y-6 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            icon={Building2}
            label="Tổng doanh nghiệp"
            value={String(stats?.totalTenants ?? 0)}
            isLoading={loadingStats}
          />
          <SummaryCard
            icon={CheckCircle}
            label="Đang hoạt động"
            value={String(stats?.activeTenants ?? 0)}
            isLoading={loadingStats}
          />
          <SummaryCard
            icon={XCircle}
            label="Đã khóa"
            value={String(stats?.suspendedTenants ?? 0)}
            isLoading={loadingStats}
          />
          <SummaryCard
            icon={Wallet}
            label="Độ chính xác AI"
            value={`${stats?.aiAccuracy ?? 0}%`}
            isLoading={loadingStats}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách doanh nghiệp</CardTitle>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên doanh nghiệp..."
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filters.status} onValueChange={(v) => setFilter('status', v)}>
                <SelectTrigger className="whitespace-nowrap sm:w-44">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="suspended">Đã khóa</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.plan} onValueChange={(v) => setFilter('plan', v)}>
                <SelectTrigger className="whitespace-nowrap sm:w-40">
                  <SelectValue placeholder="Gói" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả gói</SelectItem>
                  {Object.entries(PLAN_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {debouncedFilters.search.trim() ? (
                  <Badge variant="secondary">"{debouncedFilters.search.trim()}"</Badge>
                ) : null}
                {isSearchPending ? (
                  <span className="text-xs text-muted-foreground">Đang tìm...</span>
                ) : null}
                <Button variant="link" size="sm" className="h-auto px-1" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            <PaginatedListView<Tenant>
              items={filteredTenants}
              isLoading={loadingTenants}
              isError={tenantsError}
              error={null}
              refetch={() => refetchTenants()}
              skeletonRows={6}
              skeletonColumns={6}
              emptyTitle={
                hasActiveFilters
                  ? 'Không tìm thấy doanh nghiệp phù hợp'
                  : 'Chưa có doanh nghiệp nào'
              }
              emptyDescription={
                hasActiveFilters
                  ? 'Thử đổi từ khóa hoặc bộ lọc khác'
                  : 'Danh sách sẽ hiện ra khi có tenant đăng ký'
              }
              hasActiveFilters={hasActiveFilters}
              clearFilters={clearFilters}
              renderMobileItem={(t) => (
                <Card key={t.id} className="py-4">
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{t.businessName}</p>
                      <PaymentStatusBadge
                        status={t.status === 'suspended' ? 'suspended' : 'active'}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {t.plan ? (PLAN_LABELS[t.plan] ?? t.plan) : '—'}
                      </Badge>
                      <span className="text-muted-foreground">
                        {t.transactionsThisMonth} GD/tháng
                      </span>
                      <span className="font-medium">{formatVND(t.revenuePerMonth)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewingTenantId(t.id)}>
                        <Eye className="size-4" />
                        Chi tiết
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSetPlanTarget(t);
                          setSelectedNewPlan(t.plan ?? 'free');
                        }}
                      >
                        <Settings2 className="size-3.5" />
                        Đổi gói
                      </Button>
                      {t.status === 'suspended' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activateMutation.isPending}
                          onClick={() => setTenantAction({ type: 'activate', tenant: t })}
                        >
                          Mở khóa
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={suspendMutation.isPending}
                          onClick={() => setTenantAction({ type: 'suspend', tenant: t })}
                        >
                          Khóa
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
              renderDesktopHeader={() => (
                <tr>
                  <th className="pb-2 pl-4 font-medium">Doanh nghiệp</th>
                  <th className="pb-2 font-medium">Gói</th>
                  <th className="pb-2 font-medium">Trạng thái</th>
                  <th className="pb-2 font-medium">GD/tháng</th>
                  <th className="pb-2 font-medium">Doanh thu</th>
                  <th className="pb-2 pr-4 font-medium text-center">Thao tác</th>
                </tr>
              )}
              renderDesktopRow={(t) => (
                <tr key={t.id}>
                  <td className="py-2 pl-4 font-medium">{t.businessName}</td>
                  <td className="py-2">
                    <Badge variant="secondary">
                      {t.plan ? (PLAN_LABELS[t.plan] ?? t.plan) : '—'}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <PaymentStatusBadge
                      status={t.status === 'suspended' ? 'suspended' : 'active'}
                    />
                  </td>
                  <td className="py-2">{t.transactionsThisMonth}</td>
                  <td className="py-2">{formatVND(t.revenuePerMonth)}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setViewingTenantId(t.id)}>
                        <Eye className="size-4" />
                        Chi tiết
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSetPlanTarget(t);
                          setSelectedNewPlan(t.plan ?? 'free');
                        }}
                      >
                        <Settings2 className="size-3.5" />
                        Đổi gói
                      </Button>
                      {t.status === 'suspended' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={activateMutation.isPending}
                          onClick={() => setTenantAction({ type: 'activate', tenant: t })}
                        >
                          Mở khóa
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={suspendMutation.isPending}
                          onClick={() => setTenantAction({ type: 'suspend', tenant: t })}
                        >
                          Khóa
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              pagination={{
                page,
                totalPages,
                total: tenantsData?.total ?? 0,
                label: '{total} doanh nghiệp',
                onPageChange: setPage,
              }}
            />
          </CardContent>
        </Card>

        <TenantDetailDialog
          open={viewingTenantId !== null}
          onOpenChange={(open) => !open && setViewingTenantId(null)}
          tenantDetail={tenantDetail ?? null}
          loadingDetail={loadingDetail}
        />

        <SetPlanDialog
          open={setPlanTarget !== null && !confirmSetPlan}
          onOpenChange={(open) => {
            if (!open) {
              setSetPlanTarget(null);
              setSelectedNewPlan('');
            }
          }}
          target={setPlanTarget}
          planPricing={planPricing ?? null}
          selectedPlan={selectedNewPlan}
          onSelectedPlanChange={setSelectedNewPlan}
          onConfirm={() => setConfirmSetPlan(true)}
          isPending={setPlanMutation.isPending}
        />

        <ConfirmDialog
          open={confirmSetPlan}
          onOpenChange={(open) => !open && setConfirmSetPlan(false)}
          title="Xác nhận đổi gói dịch vụ?"
          description={
            setPlanTarget && selectedNewPlan
              ? `Bạn sắp chuyển "${setPlanTarget.businessName}" sang gói ${PLAN_LABELS[selectedNewPlan] ?? selectedNewPlan}. Subscription hiện tại sẽ bị huỷ và thay bằng gói mới ngay lập tức.`
              : ''
          }
          confirmLabel="Xác nhận đổi gói"
          loading={setPlanMutation.isPending}
          onConfirm={() => {
            if (setPlanTarget && selectedNewPlan) {
              setPlanMutation.mutate({ id: setPlanTarget.id, targetPlan: selectedNewPlan });
            }
          }}
        />

        <ConfirmDialog
          open={tenantAction?.type === 'suspend'}
          onOpenChange={(open) => !open && setTenantAction(null)}
          title="Khóa tài khoản doanh nghiệp?"
          description={
            tenantAction?.tenant
              ? `Bạn sắp khóa "${tenantAction.tenant.businessName}". Người dùng sẽ không thể đăng nhập cho đến khi được mở khóa.`
              : ''
          }
          confirmLabel="Khóa tài khoản"
          variant="destructive"
          loading={suspendMutation.isPending}
          onConfirm={() => {
            if (tenantAction?.tenant) suspendMutation.mutate(tenantAction.tenant.id);
          }}
        />

        <ConfirmDialog
          open={tenantAction?.type === 'activate'}
          onOpenChange={(open) => !open && setTenantAction(null)}
          title="Mở khóa tài khoản doanh nghiệp?"
          description={
            tenantAction?.tenant
              ? `Bạn sắp mở khóa "${tenantAction.tenant.businessName}". Người dùng sẽ có thể đăng nhập và sử dụng hệ thống trở lại.`
              : ''
          }
          confirmLabel="Mở khóa"
          loading={activateMutation.isPending}
          onConfirm={() => {
            if (tenantAction?.tenant) activateMutation.mutate(tenantAction.tenant.id);
          }}
        />
      </div>
    </>
  );
}
