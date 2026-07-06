import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Search, Settings2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { formatVND } from '@/lib/format-vnd';
import { PLAN_LABELS } from '@/lib/plan-labels';
import type { PartnerTenant, PartnerTenantsResponse } from '@/types/partner';

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 20;

interface TenantMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface PlanPricingItem {
  plan: string;
  pricePerMonth: number;
  transactionQuota: number;
}

interface TenantDetail {
  id: string;
  businessName: string;
  ownerName: string | null;
  createdAt: string;
  classificationThreshold: number;
  plan: string | null;
  status: string;
  pricePerMonth: number;
  transactionQuota: number;
  transactionUsedThisCycle: number;
  transactionsThisMonth: number;
  totalTransactions: number;
  aiAccuracy: number;
  members: TenantMember[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accountant: 'Kế toán',
  viewer: 'Người xem',
  cas_partner: 'Cas Partner',
};

export default function PartnerTenantsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(
    searchInput,
    SEARCH_DEBOUNCE_MS,
    useCallback(() => {
      setPage(1);
    }, []),
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | string>('all');
  const [viewingTenantId, setViewingTenantId] = useState<string | null>(null);
  const [tenantAction, setTenantAction] = useState<{
    type: 'suspend' | 'activate';
    tenant: PartnerTenant;
  } | null>(null);
  const [setPlanTarget, setSetPlanTarget] = useState<PartnerTenant | null>(null);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string>('');
  const [confirmSetPlan, setConfirmSetPlan] = useState(false);

  const {
    data: tenantsData,
    isLoading: loadingTenants,
    isError: tenantsError,
    refetch: refetchTenants,
  } = useQuery({
    queryKey: ['partner', 'tenants', page, debouncedSearch, statusFilter, planFilter],
    queryFn: () =>
      api
        .get<{ data: PartnerTenantsResponse }>('/partner/tenants', {
          params: {
            page,
            limit: PAGE_SIZE,
            search: debouncedSearch.trim() || undefined,
            status: statusFilter,
            plan: planFilter,
          },
        })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  });

  const filteredTenants = tenantsData?.items ?? [];
  const totalPages = tenantsData ? Math.max(1, tenantsData.totalPages) : 1;

  const { data: planPricing } = useQuery({
    queryKey: ['partner', 'plan-pricing'],
    queryFn: () =>
      api.get<{ data: PlanPricingItem[] }>('/partner/plan-pricing').then((r) => r.data.data),
  });

  const { data: tenantDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['partner', 'tenant-detail', viewingTenantId],
    queryFn: () =>
      api
        .get<{ data: TenantDetail }>(`/partner/tenants/${viewingTenantId}`)
        .then((r) => r.data.data),
    enabled: viewingTenantId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['partner', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['partner', 'tenants'] });
  };

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/partner/tenants/${id}/suspend`),
    onSuccess: () => {
      toast.success('Đã khóa tài khoản doanh nghiệp');
      setTenantAction(null);
      invalidate();
    },
    onError: () => toast.error('Không thể khóa tài khoản'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/partner/tenants/${id}/activate`),
    onSuccess: () => {
      toast.success('Đã mở khóa tài khoản doanh nghiệp');
      setTenantAction(null);
      invalidate();
    },
    onError: () => toast.error('Không thể mở khóa tài khoản'),
  });

  const setPlanMutation = useMutation({
    mutationFn: ({ id, targetPlan }: { id: string; targetPlan: string }) =>
      api.patch(`/partner/tenants/${id}/plan`, { targetPlan }),
    onSuccess: () => {
      toast.success(
        `Đã chuyển "${setPlanTarget?.businessName}" sang gói ${PLAN_LABELS[selectedNewPlan] ?? selectedNewPlan}`,
      );
      setConfirmSetPlan(false);
      setSetPlanTarget(null);
      setSelectedNewPlan('');
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['partner', 'tenant-detail'] });
    },
    onError: () => toast.error('Không thể đổi gói dịch vụ'),
  });

  const hasActiveFilters =
    debouncedSearch.trim() !== '' || statusFilter !== 'all' || planFilter !== 'all';
  const isSearchPending = searchInput !== debouncedSearch;

  const clearFilters = useCallback(() => {
    setSearchInput('');
    setStatusFilter('all');
    setPlanFilter('all');
    setPage(1);
  }, []);

  return (
    <>
      <Header
        title="Doanh nghiệp"
        description="Quản lý toàn bộ doanh nghiệp đang sử dụng X-Cash AI"
        hideThemeToggle
      />

      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Danh sách doanh nghiệp</CardTitle>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo tên doanh nghiệp..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as typeof statusFilter);
                  setPage(1);
                }}
              >
                <SelectTrigger className="whitespace-nowrap sm:w-44">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="active">Hoạt động</SelectItem>
                  <SelectItem value="suspended">Đã khóa</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={planFilter}
                onValueChange={(v) => {
                  setPlanFilter(v);
                  setPage(1);
                }}
              >
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
                {debouncedSearch.trim() ? (
                  <Badge variant="secondary">"{debouncedSearch.trim()}"</Badge>
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
            {loadingTenants ? (
              <TableSkeleton rows={6} columns={6} />
            ) : tenantsError ? (
              <EmptyState
                title="Không tải được dữ liệu"
                description="Đã có lỗi xảy ra khi tải danh sách doanh nghiệp"
                action={
                  <Button variant="outline" onClick={() => refetchTenants()}>
                    Thử lại
                  </Button>
                }
              />
            ) : !filteredTenants.length ? (
              <EmptyState
                title={
                  hasActiveFilters
                    ? 'Không tìm thấy doanh nghiệp phù hợp'
                    : 'Chưa có doanh nghiệp nào'
                }
                description={
                  hasActiveFilters
                    ? 'Thử đổi từ khóa hoặc bộ lọc khác'
                    : 'Danh sách sẽ hiện ra khi có tenant đăng ký'
                }
                action={
                  hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Xóa bộ lọc
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="space-y-3 lg:hidden">
                  {filteredTenants.map((t) => (
                    <Card key={t.id} className="py-4">
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{t.businessName}</p>
                          {t.status === 'suspended' ? (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              Đã khóa
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Hoạt động
                            </Badge>
                          )}
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
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewingTenantId(t.id)}
                          >
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
                  ))}
                </div>

                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4 font-medium">Doanh nghiệp</th>
                        <th className="pb-2 pr-4 font-medium">Gói</th>
                        <th className="pb-2 pr-4 font-medium">Trạng thái</th>
                        <th className="pb-2 pr-4 font-medium">GD/tháng</th>
                        <th className="pb-2 pr-4 font-medium">Doanh thu</th>
                        <th className="pb-2 font-medium">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredTenants.map((t) => (
                        <tr key={t.id} className="hover:bg-muted/30">
                          <td className="py-2 pr-4 font-medium">{t.businessName}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="secondary">
                              {t.plan ? (PLAN_LABELS[t.plan] ?? t.plan) : '—'}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">
                            {t.status === 'suspended' ? (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Đã khóa
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                Hoạt động
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 pr-4">{t.transactionsThisMonth}</td>
                          <td className="py-2 pr-4">{formatVND(t.revenuePerMonth)}</td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewingTenantId(t.id)}
                              >
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 ? (
                  <div className="mt-4 flex items-center justify-between gap-2 border-t pt-4">
                    <p className="text-sm text-muted-foreground">
                      Trang {page}/{totalPages}
                      {tenantsData ? ` · ${tenantsData.total} doanh nghiệp` : ''}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="size-4" />
                        Trước
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Sau
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={viewingTenantId !== null}
          onOpenChange={(open) => !open && setViewingTenantId(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{tenantDetail?.businessName ?? 'Chi tiết doanh nghiệp'}</DialogTitle>
            </DialogHeader>
            {loadingDetail || !tenantDetail ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Chủ doanh nghiệp</p>
                    <p className="font-medium">{tenantDetail.ownerName ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gói</p>
                    <p className="font-medium">
                      {tenantDetail.plan
                        ? (PLAN_LABELS[tenantDetail.plan] ?? tenantDetail.plan)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trạng thái</p>
                    {tenantDetail.status === 'suspended' ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Đã khóa
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Hoạt động
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Giá/tháng</p>
                    <p className="font-medium">{formatVND(tenantDetail.pricePerMonth)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ngưỡng định khoản tự động</p>
                    <p className="font-medium">{tenantDetail.classificationThreshold}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quota GD/chu kỳ</p>
                    <p className="font-medium">
                      {tenantDetail.transactionUsedThisCycle} / {tenantDetail.transactionQuota}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">GD tháng này / tổng</p>
                    <p className="font-medium">
                      {tenantDetail.transactionsThisMonth} / {tenantDetail.totalTransactions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Độ chính xác AI (tháng này)</p>
                    <p className="font-medium">{tenantDetail.aiAccuracy}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Ngày tạo</p>
                    <p className="font-medium">
                      {new Date(tenantDetail.createdAt).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Thành viên ({tenantDetail.members.length})
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {tenantDetail.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                        <Badge variant="secondary">{ROLE_LABELS[m.role] ?? m.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog chọn gói muốn đổi */}
        <Dialog
          open={setPlanTarget !== null && !confirmSetPlan}
          onOpenChange={(open) => {
            if (!open) {
              setSetPlanTarget(null);
              setSelectedNewPlan('');
            }
          }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Đổi gói dịch vụ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm">
              <p className="text-muted-foreground">
                Doanh nghiệp:{' '}
                <span className="font-medium text-foreground">{setPlanTarget?.businessName}</span>
              </p>
              <p className="text-muted-foreground">
                Gói hiện tại:{' '}
                <span className="font-medium text-foreground">
                  {setPlanTarget?.plan
                    ? (PLAN_LABELS[setPlanTarget.plan] ?? setPlanTarget.plan)
                    : '—'}
                </span>
              </p>
              <div className="space-y-1.5">
                <p className="font-medium">Chọn gói mới</p>
                <Select value={selectedNewPlan} onValueChange={setSelectedNewPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn gói..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(planPricing ?? []).map((p) => (
                      <SelectItem key={p.plan} value={p.plan}>
                        <span className="flex items-center gap-2">
                          <span>{PLAN_LABELS[p.plan] ?? p.plan}</span>
                          <span className="text-xs text-muted-foreground">
                            —{' '}
                            {p.pricePerMonth === 0
                              ? 'Miễn phí'
                              : `${formatVND(p.pricePerMonth)}/tháng`}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSetPlanTarget(null);
                  setSelectedNewPlan('');
                }}
              >
                Hủy
              </Button>
              <Button
                disabled={!selectedNewPlan || selectedNewPlan === setPlanTarget?.plan}
                onClick={() => setConfirmSetPlan(true)}
              >
                Tiếp tục
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
