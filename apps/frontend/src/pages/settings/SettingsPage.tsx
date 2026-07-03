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
import { useState } from 'react';
import { toast } from 'sonner';
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
import { cn } from '@/lib/utils';

function formatVND(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

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

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/team/members/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa thành viên');
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
                        onClick={() => remove(m.id)}
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

function BillingTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'current-plan'],
    queryFn: () => api.get<{ data: PlanData }>('/billing/current-plan').then((r) => r.data.data),
  });

  const planLabel: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };

  if (isLoading) return <Skeleton className="h-48" />;

  const usedPct = data
    ? Math.min(100, Math.round((data.transactionUsed / data.transactionQuota) * 100))
    : 0;
  const isNearLimit = usedPct >= 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gói dịch vụ</CardTitle>
        <CardDescription>Gói hiện tại và usage của doanh nghiệp</CardDescription>
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
                  {planLabel[data.plan] ?? data.plan}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {data.pricePerMonth > 0 ? `${formatVND(data.pricePerMonth)}/tháng` : 'Miễn phí'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Hết chu kỳ: {new Date(data.currentCycleEnd).toLocaleDateString('vi-VN')}
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Giao dịch đã dùng</span>
                <span className={cn('font-medium', isNearLimit && 'text-destructive')}>
                  {data.transactionUsed.toLocaleString()} / {data.transactionQuota.toLocaleString()}
                </span>
              </div>
              <Progress value={usedPct} className={cn(isNearLimit && '[&>div]:bg-destructive')} />
              {isNearLimit && (
                <p className="text-xs text-destructive">
                  Sắp đạt giới hạn. Nâng cấp gói để tiếp tục nhận giao dịch.
                </p>
              )}
            </div>

            <Separator />

            <p className="text-sm text-muted-foreground">
              Để nâng cấp gói, vui lòng liên hệ đội ngũ Klassi AI.
            </p>
          </>
        )}
      </CardContent>
    </Card>
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
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Cài đặt</h1>
        <p className="text-sm text-muted-foreground">Quản lý tài khoản và cấu hình hệ thống</p>
      </div>

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
  );
}
