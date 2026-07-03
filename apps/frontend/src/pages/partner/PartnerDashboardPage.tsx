import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Eye, Percent, Search, ShieldCheck, Wallet } from 'lucide-react';
import { type ElementType, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatVND, formatVNDAxis } from '@/lib/format-vnd';

interface PartnerStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  transactionsThisMonth: number;
  revenueThisMonth: number;
  aiAccuracy: number;
}

interface RevenueTrendPoint {
  month: string;
  revenue: number;
}

interface PartnerTenant {
  id: string;
  businessName: string;
  createdAt: string;
  plan: string | null;
  status: string;
  transactionsThisMonth: number;
  revenuePerMonth: number;
}

interface TenantMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface TenantDetail {
  id: string;
  businessName: string;
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

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accountant: 'Kế toán',
  viewer: 'Người xem',
  cas_partner: 'Cas Partner',
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerDashboardPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [planFilter, setPlanFilter] = useState<'all' | string>('all');
  const [viewingTenantId, setViewingTenantId] = useState<string | null>(null);
  const [tenantAction, setTenantAction] = useState<{
    type: 'suspend' | 'activate';
    tenant: PartnerTenant;
  } | null>(null);

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['partner', 'stats'],
    queryFn: () => api.get<{ data: PartnerStats }>('/partner/stats').then((r) => r.data.data),
  });

  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ['partner', 'tenants'],
    queryFn: () => api.get<{ data: PartnerTenant[] }>('/partner/tenants').then((r) => r.data.data),
  });

  const { data: revenueTrend, isLoading: loadingTrend } = useQuery({
    queryKey: ['partner', 'revenue-trend'],
    queryFn: () =>
      api.get<{ data: RevenueTrendPoint[] }>('/partner/revenue-trend').then((r) => r.data.data),
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

  const filteredTenants = useMemo(() => {
    if (!tenants) return [];
    const term = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (term && !t.businessName.toLowerCase().includes(term)) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (planFilter !== 'all' && t.plan !== planFilter) return false;
      return true;
    });
  }, [tenants, search, statusFilter, planFilter]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Tổng quan toàn hệ thống X-Cash AI</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Tổng doanh nghiệp"
          value={loadingStats ? '—' : String(stats?.totalTenants ?? 0)}
        />
        <StatCard
          icon={ShieldCheck}
          label="Hoạt động / Đã khóa"
          value={
            loadingStats ? '—' : `${stats?.activeTenants ?? 0} / ${stats?.suspendedTenants ?? 0}`
          }
        />
        <StatCard
          icon={Wallet}
          label="Doanh thu tháng này"
          value={loadingStats ? '—' : formatVND(stats?.revenueThisMonth ?? 0)}
        />
        <StatCard
          icon={Percent}
          label="Độ chính xác AI"
          value={loadingStats ? '—' : `${stats?.aiAccuracy ?? 0}%`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Doanh thu 6 tháng qua</CardTitle>
          <CardDescription>Tổng doanh thu nâng cấp gói toàn hệ thống theo tháng</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTrend ? (
            <Skeleton className="h-[240px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={revenueTrend ?? []}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(value: number) => formatVNDAxis(value)}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => formatVND(Number(value))}
                  labelFormatter={(label) => `Tháng ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--chart-1)', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách doanh nghiệp</CardTitle>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên doanh nghiệp..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="suspended">Đã khóa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="sm:w-40">
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
        </CardHeader>
        <CardContent>
          {loadingTenants ? (
            <TableSkeleton rows={6} columns={6} />
          ) : !tenants?.length ? (
            <EmptyState
              title="Chưa có doanh nghiệp nào"
              description="Danh sách sẽ hiện ra khi có tenant đăng ký"
            />
          ) : !filteredTenants.length ? (
            <EmptyState
              title="Không tìm thấy doanh nghiệp phù hợp"
              description="Thử đổi từ khóa hoặc bộ lọc khác"
            />
          ) : (
            <div className="overflow-x-auto">
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
          )}
        </CardContent>
      </Card>

      {/* Dialog chi tiết tenant */}
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
                    {new Date(tenantDetail.createdAt).toLocaleDateString('vi-VN')}
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
  );
}
