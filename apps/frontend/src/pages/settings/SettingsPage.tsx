import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellRing,
  Building2,
  CreditCard,
  Lock,
  Sliders,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/dashboard-transactions';
import { formatVND } from '@/lib/format-vnd';
import { cn } from '@/lib/utils';

// ─── Tab Threshold ────────────────────────────────────────────────
function ThresholdTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'threshold'],
    queryFn: () =>
      api.get<{ data: { threshold: number } }>('/settings/threshold').then((r) => r.data.data),
  });

  const [local, setLocal] = useState<number | null>(null);
  const threshold = local ?? data?.threshold ?? 85;

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.put('/settings/threshold', { threshold }),
    onSuccess: () => {
      toast.success('Đã lưu ngưỡng confidence');
      qc.invalidateQueries({ queryKey: ['settings', 'threshold'] });
    },
    onError: () => toast.error('Không thể lưu, vui lòng thử lại'),
  });

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ngưỡng tự động định khoản</CardTitle>
        <CardDescription>
          Giao dịch có confidence ≥ ngưỡng này sẽ được định khoản tự động. Dưới ngưỡng → chuyển
          Human Review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={50}
            max={99}
            step={1}
            value={threshold}
            onChange={(e) => setLocal(Number(e.target.value))}
            className="flex-1 accent-primary"
          />
          <span className="w-16 text-center text-2xl font-bold text-primary">{threshold}%</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Mặc định: 85% — Khuyến nghị giữ trong khoảng 80–95%
        </p>
        <Button onClick={() => save()} disabled={isPending}>
          Lưu thay đổi
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Tab Notifications ────────────────────────────────────────────
function NotificationsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () =>
      api
        .get<{
          data: {
            emailEnabled: boolean;
            email: string | null;
            slackEnabled: boolean;
            slackWebhookUrl: string | null;
          };
        }>('/settings/notifications')
        .then((r) => r.data.data),
  });

  const [form, setForm] = useState({
    emailEnabled: false,
    email: '',
    slackEnabled: false,
    slackWebhookUrl: '',
  });

  // Sync from server once
  const [synced, setSynced] = useState(false);
  if (data && !synced) {
    setForm({
      emailEnabled: data.emailEnabled,
      email: data.email ?? '',
      slackEnabled: data.slackEnabled,
      slackWebhookUrl: data.slackWebhookUrl ?? '',
    });
    setSynced(true);
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => api.put('/settings/notifications', form),
    onSuccess: () => {
      toast.success('Đã lưu cấu hình thông báo');
      qc.invalidateQueries({ queryKey: ['settings', 'notifications'] });
    },
    onError: () => toast.error('Không thể lưu, vui lòng thử lại'),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cấu hình thông báo</CardTitle>
        <CardDescription>Nhận thông báo khi có giao dịch mới cần xét duyệt.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Email</p>
              <p className="text-xs text-muted-foreground">Nhận thông báo qua email</p>
            </div>
            <Switch
              checked={form.emailEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, emailEnabled: v }))}
            />
          </div>
          {form.emailEnabled && (
            <Input
              placeholder="email@company.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Slack</p>
              <p className="text-xs text-muted-foreground">Webhook URL</p>
            </div>
            <Switch
              checked={form.slackEnabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, slackEnabled: v }))}
            />
          </div>
          {form.slackEnabled && (
            <Input
              placeholder="https://hooks.slack.com/..."
              value={form.slackWebhookUrl}
              onChange={(e) => setForm((f) => ({ ...f, slackWebhookUrl: e.target.value }))}
            />
          )}
        </div>

        <Button onClick={() => save()} disabled={isPending}>
          Lưu cấu hình
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Tab Team ─────────────────────────────────────────────────────
interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  invitedBy: { name: string } | null;
}

function TeamTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'accountant', password: '' });

  const { data: members, isLoading } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: () => api.get<{ data: Member[] }>('/team/members').then((r) => r.data.data),
  });

  const { mutate: invite, isPending: inviting } = useMutation({
    mutationFn: () => api.post('/team/members', form),
    onSuccess: () => {
      toast.success('Đã thêm thành viên');
      qc.invalidateQueries({ queryKey: ['team', 'members'] });
      setInviteOpen(false);
      setForm({ name: '', email: '', role: 'accountant', password: '' });
    },
    onError: () => toast.error('Không thể thêm thành viên'),
  });

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa thành viên');
      setMemberToRemove(null);
      qc.invalidateQueries({ queryKey: ['team', 'members'] });
    },
    onError: () => toast.error('Không thể xóa thành viên'),
  });

  const roleLabel: Record<string, string> = {
    admin: 'Admin',
    accountant: 'Kế toán',
    viewer: 'Chỉ xem',
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Quản lý thành viên</CardTitle>
            <CardDescription>Danh sách user trong doanh nghiệp của bạn</CardDescription>
          </div>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4 mr-2" />
            Thêm thành viên
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => `skel-${i}`).map((k) => (
                <Skeleton key={k} className="h-12" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {members?.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                      {roleLabel[m.role] ?? m.role}
                    </Badge>
                    {m.id !== user?.id && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setMemberToRemove(m)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm thành viên mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Họ tên</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="keto@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Kế toán</SelectItem>
                  <SelectItem value="viewer">Chỉ xem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mật khẩu tạm thời</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Ít nhất 8 ký tự"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={() => invite()}
              disabled={inviting || !form.name || !form.email || !form.password}
            >
              Thêm thành viên
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={memberToRemove !== null}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Xóa thành viên?"
        description={
          memberToRemove
            ? `Bạn sắp xóa "${memberToRemove.name}" (${memberToRemove.email}) khỏi doanh nghiệp. Hành động này không thể hoàn tác.`
            : ''
        }
        confirmLabel="Xóa thành viên"
        variant="destructive"
        loading={removing}
        onConfirm={() => {
          if (memberToRemove) remove(memberToRemove.id);
        }}
      />
    </>
  );
}

// ─── Tab Billing ──────────────────────────────────────────────────
interface PlanData {
  plan: string;
  pricePerMonth: number;
  transactionQuota: number;
  transactionUsed: number;
  currentCycleEnd: string;
  status: string;
}

interface UpgradeResult {
  orderCode: string;
  checkoutUrl: string;
  qrCode: string;
  amount: number;
  isMock: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const PLAN_PRICE: Record<string, number> = {
  free: 0,
  starter: 299_000,
  pro: 799_000,
  enterprise: 2_990_000,
};

const PLAN_QUOTA: Record<string, string> = {
  free: '50 GD/tháng',
  starter: '500 GD/tháng',
  pro: '2.000 GD/tháng',
  enterprise: 'Không giới hạn',
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: ['50 giao dịch/tháng', 'AI định khoản tự động', 'Export Excel'],
  starter: ['500 giao dịch/tháng', 'AI Copilot', 'Analytics', 'Email thông báo'],
  pro: ['2.000 giao dịch/tháng', 'RAG Knowledge Base', 'Slack/Discord', 'Phí vượt 600đ/GD'],
  enterprise: ['Không giới hạn GD', 'SLA cam kết', 'Partner support riêng', 'Custom Integration'],
};

const ALL_PLANS = ['free', 'starter', 'pro', 'enterprise'];

function BillingTab() {
  const qc = useQueryClient();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'current-plan'],
    queryFn: () => api.get<{ data: PlanData }>('/billing/current-plan').then((r) => r.data.data),
    // poll mỗi 5s khi dialog thanh toán đang mở để tự động detect khi payment xong
    refetchInterval: paymentOpen ? 5_000 : false,
  });

  // Tự đóng dialog khi plan đã đổi thành targetPlan
  const prevPlanRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!paymentOpen || !upgradeResult || !data) return;
    if (prevPlanRef.current && data.plan === upgradeResult?.orderCode) return;
    if (data.plan !== prevPlanRef.current && prevPlanRef.current !== undefined) {
      setPaymentOpen(false);
      setUpgradeResult(null);
      setSelectedPlan(null);
      toast.success(`Nâng cấp lên gói ${PLAN_LABEL[data.plan] ?? data.plan} thành công!`);
      qc.invalidateQueries({ queryKey: ['billing', 'current-plan'] });
    }
    prevPlanRef.current = data.plan;
  }, [data, paymentOpen, upgradeResult, qc]);

  useEffect(() => {
    if (data && !paymentOpen) prevPlanRef.current = data.plan;
  }, [data, paymentOpen]);

  const upgradeMutation = useMutation({
    mutationFn: (targetPlan: string) =>
      api
        .post<{ data: UpgradeResult }>('/billing/upgrade', { targetPlan })
        .then((r) => r.data.data),
    onSuccess: (result) => {
      setUpgradeResult(result);
      setUpgradeOpen(false);
      setPaymentOpen(true);
      prevPlanRef.current = data?.plan;
    },
    onError: () => toast.error('Không thể tạo đơn thanh toán, vui lòng thử lại'),
  });

  const mockConfirmMutation = useMutation({
    mutationFn: (orderCode: string) => api.post(`/billing/upgrade/${orderCode}/mock-confirm`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing', 'current-plan'] });
      setPaymentOpen(false);
      setUpgradeResult(null);
      setSelectedPlan(null);
      toast.success('Demo: Thanh toán thành công!');
    },
    onError: () => toast.error('Không thể xác nhận mock'),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const usedPct = data
    ? Math.min(100, Math.round((data.transactionUsed / data.transactionQuota) * 100))
    : 0;
  const isNearLimit = usedPct >= 80;
  const isDev = import.meta.env.DEV;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Gói dịch vụ</CardTitle>
              <CardDescription>Gói hiện tại và usage của doanh nghiệp</CardDescription>
            </div>
            {data && (
              <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                Nâng cấp gói
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={data.plan === 'free' ? 'secondary' : 'default'}
                    className="uppercase"
                  >
                    {PLAN_LABEL[data.plan] ?? data.plan}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {data.pricePerMonth > 0 ? `${formatVND(data.pricePerMonth)}/tháng` : 'Miễn phí'}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Hết chu kỳ: {formatDateVN(data.currentCycleEnd)}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Giao dịch đã dùng</span>
                  <span className={cn('font-medium', isNearLimit && 'text-destructive')}>
                    {data.transactionUsed.toLocaleString()} /{' '}
                    {data.transactionQuota.toLocaleString()}
                  </span>
                </div>
                <Progress value={usedPct} className={cn(isNearLimit && '[&>div]:bg-destructive')} />
                {isNearLimit && (
                  <p className="text-xs text-destructive">
                    Sắp đạt giới hạn. Nâng cấp gói để tiếp tục nhận giao dịch.
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog chọn gói */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chọn gói dịch vụ</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ALL_PLANS.map((plan) => {
              const isCurrent = data?.plan === plan;
              const isSelected = selectedPlan === plan;
              return (
                <button
                  key={plan}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => setSelectedPlan(plan)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all',
                    isCurrent
                      ? 'cursor-not-allowed border-primary/40 bg-primary/5 opacity-60'
                      : isSelected
                        ? 'border-primary ring-1 ring-primary'
                        : 'hover:border-primary/50',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold">{PLAN_LABEL[plan]}</span>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-[10px]">
                        Hiện tại
                      </Badge>
                    )}
                  </div>
                  <p className="mb-2 text-lg font-bold text-primary">
                    {PLAN_PRICE[plan] === 0
                      ? 'Miễn phí'
                      : `${formatVND(PLAN_PRICE[plan] ?? 0)}/tháng`}
                  </p>
                  <p className="mb-2 text-xs text-muted-foreground">{PLAN_QUOTA[plan]}</p>
                  <ul className="space-y-1">
                    {(PLAN_FEATURES[plan] ?? []).map((f) => (
                      <li
                        key={f}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <span className="text-primary">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={!selectedPlan || upgradeMutation.isPending}
              onClick={() => selectedPlan && upgradeMutation.mutate(selectedPlan)}
            >
              {upgradeMutation.isPending ? 'Đang tạo đơn...' : 'Tiếp tục thanh toán'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog thanh toán */}
      <Dialog
        open={paymentOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentOpen(false);
            setUpgradeResult(null);
            setSelectedPlan(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Thanh toán nâng cấp gói</DialogTitle>
          </DialogHeader>
          {upgradeResult && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Số tiền:{' '}
                <span className="font-semibold text-foreground">
                  {formatVND(upgradeResult.amount)}
                </span>
              </p>

              {upgradeResult.qrCode ? (
                <img
                  src={upgradeResult.qrCode}
                  alt="QR thanh toán"
                  className="mx-auto size-48 rounded-lg border"
                />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                  {upgradeResult.isMock ? 'QR mock — chưa có PayOS key thật' : 'Đang tải QR...'}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open(upgradeResult.checkoutUrl, '_blank')}
              >
                Mở trang thanh toán PayOS
              </Button>

              <p className="text-xs text-muted-foreground">
                Hệ thống tự cập nhật sau khi thanh toán xong. Có thể đóng cửa sổ này rồi quay lại
                sau.
              </p>

              {isDev && (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={mockConfirmMutation.isPending}
                  onClick={() => mockConfirmMutation.mutate(upgradeResult.orderCode)}
                >
                  {mockConfirmMutation.isPending
                    ? 'Đang xử lý...'
                    : '🧪 Demo: Giả lập thanh toán thành công'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Tab Banking ──────────────────────────────────────────────────
function BankingTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['onboarding', 'status'],
    queryFn: () =>
      api
        .get<{
          data: {
            grants: Array<{
              id: string;
              bankName: string | null;
              accountNumber: string | null;
              accountHolderName: string | null;
              bankLogo: string | null;
            }>;
          };
        }>('/onboarding/status')
        .then((r) => r.data.data),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tài khoản ngân hàng</CardTitle>
        <CardDescription>
          Tài khoản đã liên kết qua Cas Link để nhận giao dịch real-time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }, (_, i) => `skel-${i}`).map((k) => (
              <Skeleton key={k} className="h-14" />
            ))}
          </div>
        ) : !data?.grants?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Chưa liên kết tài khoản ngân hàng nào.
          </p>
        ) : (
          <div className="space-y-2">
            {data.grants.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-lg border p-3">
                {g.bankLogo ? (
                  <img
                    src={g.bankLogo}
                    alt={g.bankName ?? ''}
                    className="size-8 rounded object-contain"
                  />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded bg-muted">
                    <Building2 className="size-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{g.bankName ?? 'Ngân hàng'}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.accountNumber} {g.accountHolderName ? `• ${g.accountHolderName}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  Đã liên kết
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const tabs = [
    { value: 'banking', label: 'Ngân hàng', icon: Building2, component: <BankingTab /> },
    {
      value: 'threshold',
      label: 'Ngưỡng AI',
      icon: Sliders,
      adminOnly: true,
      component: <ThresholdTab />,
    },
    {
      value: 'notifications',
      label: 'Thông báo',
      icon: BellRing,
      adminOnly: true,
      component: <NotificationsTab />,
    },
    { value: 'team', label: 'Thành viên', icon: Users, adminOnly: true, component: <TeamTab /> },
    { value: 'billing', label: 'Gói dịch vụ', icon: CreditCard, component: <BillingTab /> },
  ];

  return (
    <>
      <Header title="Cài đặt" description="Quản lý tài khoản và cấu hình hệ thống" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Tabs defaultValue="banking">
          <TabsList className="w-full justify-start gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const locked = tab.adminOnly && !isAdmin;
              return (
                <TabsTrigger key={tab.value} value={tab.value} disabled={locked} className="gap-2">
                  <Icon className="size-3.5" />
                  {tab.label}
                  {locked && <Lock className="size-3 opacity-50" />}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-4">
              {tab.component}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </>
  );
}
