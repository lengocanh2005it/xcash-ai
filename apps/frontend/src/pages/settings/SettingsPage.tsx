import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SubscriptionPlan } from '@xcash/shared-types';
import {
  AlertTriangle,
  BellRing,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lock,
  Mail,
  MessageSquare,
  ScrollText,
  Search,
  Sliders,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AuditLogPanel } from '@/components/audit/AuditLogPanel';
import { Header } from '@/components/layout/Header';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TransactionSourceBadge } from '@/components/shared/TransactionSourceBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/dashboard-transactions';
import { formatVND } from '@/lib/format-vnd';
import { formatCopilotQuota, formatTransactionQuota, hasPlanAccess, PLAN_LABEL } from '@/lib/plan';
import { cn } from '@/lib/utils';
import { CopilotHistoryTab } from '@/pages/settings/CopilotHistoryTab';

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
          <Label htmlFor="threshold-slider" className="sr-only">
            Ngưỡng tự động định khoản
          </Label>
          <input
            id="threshold-slider"
            type="range"
            min={50}
            max={99}
            step={1}
            value={threshold}
            onChange={(e) => setLocal(Number(e.target.value))}
            className="flex-1 accent-primary"
            aria-valuemin={50}
            aria-valuemax={99}
            aria-valuenow={threshold}
            aria-describedby="threshold-hint"
          />
          <span className="w-16 text-center text-2xl font-bold text-primary">{threshold}%</span>
        </div>
        <p id="threshold-hint" className="text-xs text-muted-foreground">
          Mặc định: 85% — Khuyến nghị giữ trong khoảng 80–95%
        </p>
        <Button onClick={() => save()} disabled={isPending}>
          Lưu thay đổi
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Slack Webhook Input ──────────────────────────────────────────
function SlackWebhookInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { mutate: test, isPending } = useMutation({
    mutationFn: () => api.post('/settings/notifications/test-slack', { webhookUrl: value }),
    onSuccess: () => toast.success('Kết nối Slack thành công!'),
    onError: () => toast.error('Webhook URL không hợp lệ hoặc không thể kết nối.'),
  });

  const isValidUrl = value.startsWith('https://hooks.slack.com/');

  return (
    <div className="flex gap-2">
      <Input
        placeholder="https://hooks.slack.com/..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!isValidUrl || isPending}
        onClick={() => test()}
        className="shrink-0"
      >
        {isPending ? 'Đang kiểm tra...' : 'Kiểm tra'}
      </Button>
    </div>
  );
}

// ─── Tab Notifications ────────────────────────────────────────────
function NotificationsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEmail = hasPlanAccess(user?.plan, SubscriptionPlan.STARTER);
  const canSlack = hasPlanAccess(user?.plan, SubscriptionPlan.PRO);
  // Cả 2 kênh đều bị khoá → không có gì để cấu hình → khoá luôn nút lưu.
  const allLocked = !canEmail && !canSlack;
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
  useEffect(() => {
    if (!data || synced) return;
    setForm({
      emailEnabled: data.emailEnabled,
      email: data.email ?? '',
      slackEnabled: data.slackEnabled,
      slackWebhookUrl: data.slackWebhookUrl ?? '',
    });
    setSynced(true);
  }, [data, synced]);

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
              <p className="flex items-center gap-1.5 font-medium text-sm">
                Email
                {!canEmail && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Lock className="size-2.5" /> Gói {PLAN_LABEL[SubscriptionPlan.STARTER]}+
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Nhận thông báo qua email</p>
            </div>
            <Switch
              checked={form.emailEnabled}
              disabled={!canEmail}
              onCheckedChange={(v) => setForm((f) => ({ ...f, emailEnabled: v }))}
            />
          </div>
          {canEmail && form.emailEnabled && (
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
              <p className="flex items-center gap-1.5 font-medium text-sm">
                Slack
                {!canSlack && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Lock className="size-2.5" /> Gói {PLAN_LABEL[SubscriptionPlan.PRO]}+
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Webhook URL</p>
            </div>
            <Switch
              checked={form.slackEnabled}
              disabled={!canSlack}
              onCheckedChange={(v) => setForm((f) => ({ ...f, slackEnabled: v }))}
            />
          </div>
          {canSlack && form.slackEnabled && (
            <SlackWebhookInput
              value={form.slackWebhookUrl}
              onChange={(v) => setForm((f) => ({ ...f, slackWebhookUrl: v }))}
            />
          )}
        </div>

        {allLocked ? (
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Nút disabled không phát sự kiện hover → bọc span làm trigger tooltip. */}
              <span className="inline-flex cursor-not-allowed">
                <Button disabled className="pointer-events-none">
                  Lưu cấu hình
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Nâng cấp lên gói {PLAN_LABEL[SubscriptionPlan.STARTER]} trở lên để bật thông báo
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button onClick={() => save()} disabled={isPending}>
            Lưu cấu hình
          </Button>
        )}
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
  emailVerifiedAt: string | null;
  invitedBy: { name: string } | null;
}

function TeamTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'accountant' });

  const { data: members, isLoading } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: () => api.get<{ data: Member[] }>('/team/members').then((r) => r.data.data),
  });

  const { mutate: invite, isPending: inviting } = useMutation({
    mutationFn: () => api.post('/team/members', form),
    onSuccess: (response) => {
      const message =
        (response.data as { data?: { message?: string } }).data?.message ??
        'Đã gửi email mời thành công';
      toast.success(message);
      qc.invalidateQueries({ queryKey: ['team', 'members'] });
      setInviteOpen(false);
      setForm({ name: '', email: '', role: 'accountant' });
    },
    onError: () => toast.error('Không thể gửi lời mời'),
  });

  const { mutate: resendInvite, isPending: isResending } = useMutation({
    mutationFn: (id: string) => api.post(`/team/members/${id}/resend-invite`),
    onSuccess: (response) => {
      const message =
        (response.data as { data?: { message?: string } }).data?.message ?? 'Đã gửi lại email mời';
      toast.success(message);
    },
    onError: () => toast.error('Không thể gửi lại email mời'),
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
              {members?.map((m) => {
                const isPending = !m.emailVerifiedAt && m.invitedBy;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isPending && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Chờ kích hoạt
                        </Badge>
                      )}
                      <Badge variant={m.role === 'admin' ? 'default' : 'secondary'}>
                        {roleLabel[m.role] ?? m.role}
                      </Badge>
                      {isPending && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Gửi lại email mời"
                          disabled={isResending}
                          onClick={() => resendInvite(m.id)}
                        >
                          <Mail className="size-4" />
                        </Button>
                      )}
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mời thành viên mới</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ gửi email chứa link kích hoạt. Thành viên tự đặt mật khẩu — Admin không
              biết mật khẩu của họ.
            </DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => invite()} disabled={inviting || !form.name || !form.email}>
              {inviting ? 'Đang gửi...' : 'Gửi lời mời'}
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
  currentCycleStart: string;
  currentCycleEnd: string;
  status: string;
  copilotQuota: number;
  copilotUsed: number;
  usageBreakdown?: { fromBank: number; fromImport: number };
}

interface UpgradeResult {
  orderCode: string;
  checkoutUrl: string;
  qrCode: string;
  amount: number;
  isMock: boolean;
}

interface OverageOrder {
  orderCode: string;
  amount: number;
  createdAt: string;
}

interface OveragePaymentResult {
  orderCode: string;
  amount: number;
  overageCount: number;
  checkoutUrl: string | null;
  qrCode: string | null;
  isMock: boolean;
  isExisting: boolean;
}

const PLAN_FEATURES: Record<string, string[]> = {
  free: [
    'Liên kết ngân hàng Cas Link',
    'AI định khoản tự động TT133',
    'Dashboard & Human Review',
    'Danh mục tài khoản TT133',
  ],
  starter: ['AI Copilot hỏi đáp tài chính', 'Phân tích thu/chi nâng cao', 'Thông báo qua Email'],
  pro: ['Báo cáo & xuất Excel', 'Thông báo qua Slack', 'Vượt quota (tính phí theo gói)'],
  enterprise: ['Hỗ trợ ưu tiên từ đối tác Cas', 'Đồng hành triển khai doanh nghiệp'],
};

const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

interface PlanFeatureLine {
  text: string;
  inherited?: boolean;
}

/** Lợi ích hiển thị: dòng "Mọi tính năng gói trước" + tính năng mới của gói này. */
function getPlanFeatureLines(plan: string): PlanFeatureLine[] {
  const index = PLAN_ORDER.indexOf(plan);
  const own = (PLAN_FEATURES[plan] ?? []).map((text) => ({ text }));
  if (index <= 0) return own;
  const prev = PLAN_ORDER[index - 1];
  return [
    { text: `Mọi tính năng gói ${PLAN_LABEL[prev as SubscriptionPlan] ?? prev}`, inherited: true },
    ...own,
  ];
}

interface BillingPlan {
  plan: string;
  pricePerMonth: number;
  transactionQuota: number;
  copilotQuota?: number;
  overagePricePerTransaction: number | null;
}

interface PaymentOrder {
  id: string;
  orderCode: string;
  orderType: 'upgrade' | 'overage';
  targetPlan: string;
  amount: number;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  paidAt: string | null;
  createdAt: string;
}

interface PaymentHistoryResponse {
  data: PaymentOrder[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

const ORDER_TYPE_LABEL: Record<string, string> = {
  upgrade: 'Nâng cấp gói',
  overage: 'Vượt quota',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  expired: 'Hết hạn',
};

const STATUS_CLASS: Record<string, string> = {
  pending:
    'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  paid: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  failed:
    'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
  expired: 'bg-muted text-muted-foreground border-border',
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PaymentHistoryTable() {
  const [orderType, setOrderType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const debouncedFrom = useDebounce(fromDate, 400);
  const debouncedTo = useDebounce(toDate, 400);

  // Reset page khi filter thay đổi
  const resetPage = useCallback(() => setPage(1), []);
  useEffect(() => {
    resetPage();
  }, [orderType, status, debouncedFrom, debouncedTo, resetPage]);

  const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
  if (orderType !== 'all') params.set('orderType', orderType);
  if (status !== 'all') params.set('status', status);
  if (debouncedFrom) params.set('fromDate', debouncedFrom);
  if (debouncedTo) params.set('toDate', debouncedTo);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'payment-history', orderType, status, debouncedFrom, debouncedTo, page],
    queryFn: () =>
      api
        .get<{ data: PaymentHistoryResponse }>(`/billing/payment-history?${params.toString()}`)
        .then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const hasActiveFilter = orderType !== 'all' || status !== 'all' || fromDate || toDate;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lịch sử thanh toán</CardTitle>
        <CardDescription>
          Toàn bộ giao dịch thanh toán gói dịch vụ và phí vượt quota
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={orderType} onValueChange={setOrderType}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Loại giao dịch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả loại</SelectItem>
              <SelectItem value="upgrade">Nâng cấp gói</SelectItem>
              <SelectItem value="overage">Vượt quota</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả trạng thái</SelectItem>
              <SelectItem value="pending">Chờ thanh toán</SelectItem>
              <SelectItem value="paid">Đã thanh toán</SelectItem>
              <SelectItem value="failed">Thất bại</SelectItem>
              <SelectItem value="expired">Hết hạn</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-8 w-36 text-xs"
              placeholder="Từ ngày"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-8 w-36 text-xs"
              placeholder="Đến ngày"
            />
          </div>

          {hasActiveFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => {
                setOrderType('all');
                setStatus('all');
                setFromDate('');
                setToDate('');
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <Search className="size-8 opacity-30" />
            <p className="text-sm">Không có giao dịch nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Mã đơn</th>
                  <th className="px-4 py-2.5 text-left font-medium">Loại</th>
                  <th className="px-4 py-2.5 text-left font-medium">Gói</th>
                  <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ngày tạo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Ngày thanh toán</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {o.orderCode}
                    </td>
                    <td className="px-4 py-3">{ORDER_TYPE_LABEL[o.orderType] ?? o.orderType}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs uppercase">
                        {PLAN_LABEL[o.targetPlan as SubscriptionPlan] ?? o.targetPlan}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatVND(o.amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                          STATUS_CLASS[o.status],
                        )}
                      >
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateVN(o.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {o.paidAt ? formatDateVN(o.paidAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {meta.total} kết quả · Trang {meta.page}/{meta.totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatPlanQuotaSubtitle(plan: BillingPlan): string {
  const quota = formatTransactionQuota(plan.transactionQuota);
  if (plan.overagePricePerTransaction != null) {
    return `${quota} · Phí vượt ${formatVND(plan.overagePricePerTransaction)}/GD`;
  }
  return quota;
}

function BillingTab() {
  const qc = useQueryClient();
  const { refreshSession, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<UpgradeResult | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [overagePaymentOpen, setOveragePaymentOpen] = useState(false);
  const [overageResult, setOverageResult] = useState<OveragePaymentResult | null>(null);
  const [cycleDetailOpen, setCycleDetailOpen] = useState(false);

  // Mở sẵn dialog chọn gói khi được điều hướng từ nút "Nâng cấp gói dịch vụ" (?upgrade=1)
  useEffect(() => {
    if (searchParams.get('upgrade') === '1') {
      setUpgradeOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('upgrade');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'current-plan'],
    queryFn: () => api.get<{ data: PlanData }>('/billing/current-plan').then((r) => r.data.data),
    // poll mỗi 5s khi dialog thanh toán đang mở để tự động detect khi payment xong
    refetchInterval: paymentOpen ? 5_000 : false,
  });

  const { data: availablePlans, isLoading: loadingPlans } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api.get<{ data: BillingPlan[] }>('/billing/plans').then((r) => r.data.data),
    enabled: upgradeOpen,
  });

  const { data: overageOrders } = useQuery({
    queryKey: ['billing', 'overage-orders'],
    queryFn: () =>
      api.get<{ data: OverageOrder[] }>('/billing/overage-orders').then((r) => r.data.data),
    refetchInterval: overagePaymentOpen ? 5_000 : 30_000,
  });

  const pendingOverage = overageOrders?.[0] ?? null;

  const overageOrderMutation = useMutation({
    mutationFn: () =>
      api.post<{ data: OveragePaymentResult }>('/billing/overage-order').then((r) => r.data.data),
    onSuccess: (result) => {
      setOverageResult(result);
      setOveragePaymentOpen(true);
    },
    onError: () => toast.error('Không thể tạo đơn thanh toán phí vượt quota'),
  });

  const mockConfirmOverageMutation = useMutation({
    mutationFn: (orderCode: string) => api.post(`/billing/overage-order/${orderCode}/mock-confirm`),
    onSuccess: () => {
      setOveragePaymentOpen(false);
      setOverageResult(null);
      qc.invalidateQueries({ queryKey: ['billing', 'overage-orders'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Demo: Đã thanh toán phí vượt quota!');
    },
    onError: () => toast.error('Không thể xác nhận mock'),
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
      toast.success(
        `Nâng cấp lên gói ${PLAN_LABEL[data.plan as SubscriptionPlan] ?? data.plan} thành công!`,
      );
      qc.invalidateQueries({ queryKey: ['billing', 'current-plan'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      void refreshSession();
    }
    prevPlanRef.current = data.plan;
  }, [data, paymentOpen, upgradeResult, qc, refreshSession]);

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
      qc.invalidateQueries({ queryKey: ['notifications'] });
      setPaymentOpen(false);
      setUpgradeResult(null);
      setSelectedPlan(null);
      toast.success('Demo: Thanh toán thành công!');
      void refreshSession();
    },
    onError: () => toast.error('Không thể xác nhận mock'),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const usedPct = data
    ? Math.min(100, Math.round((data.transactionUsed / data.transactionQuota) * 100))
    : 0;
  const isNearLimit = usedPct >= 80;

  const copilotUnlimited = data?.copilotQuota === -1;
  const copilotUsedPct =
    data && !copilotUnlimited
      ? Math.min(100, Math.round((data.copilotUsed / data.copilotQuota) * 100))
      : 0;
  const copilotNearLimit = copilotUsedPct >= 80;
  const copilotExceeded = copilotUsedPct >= 100;

  const isDev = import.meta.env.DEV;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Gói dịch vụ</CardTitle>
              <CardDescription>Gói hiện tại và usage của doanh nghiệp</CardDescription>
            </div>
            {data &&
              (data.plan === PLAN_ORDER[PLAN_ORDER.length - 1] ? (
                <Button size="sm" variant="outline" disabled>
                  Đã dùng gói cao nhất
                </Button>
              ) : isAdmin ? (
                <Button size="sm" onClick={() => setUpgradeOpen(true)}>
                  Nâng cấp gói
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-not-allowed">
                      <Button size="sm" disabled className="pointer-events-none">
                        Nâng cấp gói
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>Chỉ chủ doanh nghiệp mới có thể nâng cấp gói</TooltipContent>
                </Tooltip>
              ))}
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
                    {PLAN_LABEL[data.plan as SubscriptionPlan] ?? data.plan}
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
                {data.transactionUsed > 0 &&
                  data.usageBreakdown &&
                  (data.usageBreakdown.fromBank > 0 || data.usageBreakdown.fromImport > 0) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="inline-block size-2 rounded-full bg-primary" />
                        Ngân hàng: {data.usageBreakdown.fromBank.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="inline-block size-2 rounded-full bg-amber-500" />
                        Import Excel: {data.usageBreakdown.fromImport.toLocaleString()}
                      </span>
                    </div>
                  )}
                {data.transactionUsed > 0 && (
                  <button
                    type="button"
                    onClick={() => setCycleDetailOpen(true)}
                    className="text-xs text-primary underline-offset-2 hover:underline"
                  >
                    Xem chi tiết giao dịch trong chu kỳ →
                  </button>
                )}
              </div>

              {/* Copilot quota */}
              {!copilotUnlimited && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lượt chat Copilot</span>
                    <span
                      className={cn(
                        'font-medium',
                        copilotExceeded
                          ? 'text-destructive'
                          : copilotNearLimit
                            ? 'text-orange-500'
                            : undefined,
                      )}
                    >
                      {data.copilotUsed.toLocaleString()} / {data.copilotQuota.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={copilotUsedPct}
                    className={cn(
                      copilotExceeded
                        ? '[&>div]:bg-destructive'
                        : copilotNearLimit
                          ? '[&>div]:bg-orange-500'
                          : undefined,
                    )}
                  />
                  {copilotExceeded && (
                    <p className="text-xs text-destructive">
                      Đã dùng hết lượt chat Copilot. Nâng cấp gói để tiếp tục.
                    </p>
                  )}
                  {copilotNearLimit && !copilotExceeded && (
                    <p className="text-xs text-orange-500">
                      Sắp hết lượt chat Copilot trong chu kỳ này.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Lịch sử thanh toán */}
      <PaymentHistoryTable />

      {/* Banner phí vượt quota */}
      {pendingOverage && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-500" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Có phí vượt quota chưa thanh toán
            </p>
            <p className="text-xs text-orange-700 dark:text-orange-300">
              Số tiền cần thanh toán:{' '}
              <span className="font-semibold">{formatVND(pendingOverage.amount)}</span>. Vui lòng
              thanh toán để tránh gián đoạn dịch vụ.
            </p>
          </div>
          {isAdmin ? (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
              disabled={overageOrderMutation.isPending}
              onClick={() => overageOrderMutation.mutate()}
            >
              Thanh toán ngay
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex cursor-not-allowed">
                  <Button
                    size="sm"
                    variant="outline"
                    className="pointer-events-none shrink-0 border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-300"
                    disabled
                  >
                    Thanh toán ngay
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Chỉ chủ doanh nghiệp mới có thể thanh toán</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Dialog chọn gói */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="flex max-h-[min(88dvh,100%)] w-[min(42rem,calc(100vw-2.5rem))] max-w-2xl flex-col gap-0 overflow-hidden px-5 py-5 top-[6dvh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%] sm:px-6 sm:py-6">
          <DialogHeader className="shrink-0 pb-3 pr-8">
            <DialogTitle>Chọn gói dịch vụ</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-2">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {loadingPlans
                ? Array.from({ length: 4 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
                    <Skeleton key={i} className="h-48 w-full rounded-xl" />
                  ))
                : (availablePlans ?? []).map((planItem) => {
                    const plan = planItem.plan;
                    const isCurrent = data?.plan === plan;
                    const currentPlanItem = availablePlans?.find((p) => p.plan === data?.plan);
                    const isLower =
                      !isCurrent &&
                      currentPlanItem != null &&
                      planItem.pricePerMonth < currentPlanItem.pricePerMonth;
                    const isDisabled = isCurrent || isLower;
                    const isSelected = selectedPlan === plan;
                    return (
                      <button
                        key={plan}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedPlan(plan)}
                        className={cn(
                          'w-full min-w-0 rounded-xl border p-4 text-left transition-all',
                          isDisabled
                            ? 'cursor-not-allowed border-primary/40 bg-primary/5 opacity-60'
                            : isSelected
                              ? 'border-primary ring-1 ring-primary'
                              : 'hover:border-primary/50',
                        )}
                      >
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                          <span className="font-semibold">
                            {PLAN_LABEL[plan as SubscriptionPlan] ?? plan}
                          </span>
                          {isCurrent && (
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              Hiện tại
                            </Badge>
                          )}
                          {isLower && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] text-muted-foreground"
                            >
                              Không khả dụng
                            </Badge>
                          )}
                        </div>
                        <p className="mb-2 text-lg font-bold text-primary break-words">
                          {planItem.pricePerMonth === 0
                            ? 'Miễn phí'
                            : `${formatVND(planItem.pricePerMonth)}/tháng`}
                        </p>
                        <div className="mb-2 space-y-0.5 text-xs text-muted-foreground break-words">
                          <p>{formatPlanQuotaSubtitle(planItem)}</p>
                          <p>{formatCopilotQuota(planItem.copilotQuota, plan)}</p>
                        </div>
                        <ul className="space-y-1">
                          {getPlanFeatureLines(plan).map((f) => (
                            <li
                              key={f.text}
                              className={cn(
                                'flex items-start gap-1.5 text-xs break-words',
                                f.inherited
                                  ? 'font-medium text-foreground'
                                  : 'text-muted-foreground',
                              )}
                            >
                              <span className="shrink-0 text-primary">✓</span>
                              <span>{f.text}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
            </div>
          </div>
          <DialogFooter className="mt-4 shrink-0 gap-2.5 border-t border-border pt-4 sm:gap-2">
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
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent
          className="max-w-sm"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
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
                <div className="mx-auto w-fit rounded-lg border p-3">
                  <QRCodeSVG value={upgradeResult.qrCode} size={176} />
                </div>
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
          <DialogFooter className="sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setPaymentOpen(false)}
            >
              Đóng — thanh toán sau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog thanh toán phí vượt quota */}
      <Dialog open={overagePaymentOpen} onOpenChange={setOveragePaymentOpen}>
        <DialogContent
          className="max-w-sm"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Thanh toán phí vượt quota</DialogTitle>
          </DialogHeader>
          {overageResult && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Số giao dịch vượt:{' '}
                <span className="font-semibold text-foreground">
                  {overageResult.overageCount} GD
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Số tiền:{' '}
                <span className="font-semibold text-foreground">
                  {formatVND(overageResult.amount)}
                </span>
              </p>

              {overageResult.qrCode ? (
                <div className="mx-auto w-fit rounded-lg border p-3">
                  <QRCodeSVG value={overageResult.qrCode} size={176} />
                </div>
              ) : (
                <div className="flex h-36 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                  {overageResult.isMock ? 'QR mock — chưa có PayOS key thật' : 'Đang tải QR...'}
                </div>
              )}

              {overageResult.checkoutUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(overageResult.checkoutUrl!, '_blank')}
                >
                  Mở trang thanh toán PayOS
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                Hệ thống tự cập nhật sau khi thanh toán xong.
              </p>

              {isDev && (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={mockConfirmOverageMutation.isPending}
                  onClick={() => mockConfirmOverageMutation.mutate(overageResult.orderCode)}
                >
                  {mockConfirmOverageMutation.isPending
                    ? 'Đang xử lý...'
                    : '🧪 Demo: Giả lập thanh toán thành công'}
                </Button>
              )}
            </div>
          )}
          <DialogFooter className="sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setOveragePaymentOpen(false)}
            >
              Đóng — thanh toán sau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chi tiết giao dịch trong chu kỳ */}
      {data && (
        <CycleTransactionsDialog
          open={cycleDetailOpen}
          onOpenChange={setCycleDetailOpen}
          cycleStart={data.currentCycleStart}
          cycleEnd={data.currentCycleEnd}
        />
      )}
    </div>
  );
}

interface CycleTransaction {
  id: string;
  transactionId: string;
  amount: number;
  content: string;
  transactionDate: string;
  createdAt: string;
  senderAccount: string | null;
  source: 'cas' | 'import';
  classification: {
    debitAccount: string | null;
    creditAccount: string | null;
    status: string;
  } | null;
}

interface CycleTransactionsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cycleStart: string;
  cycleEnd: string;
}

function CycleTransactionsDialog({
  open,
  onOpenChange,
  cycleStart,
  cycleEnd,
}: CycleTransactionsDialogProps) {
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 15;
  const debouncedSearch = useDebounce(search, 400);
  const debouncedFrom = useDebounce(fromDate, 400);
  const debouncedTo = useDebounce(toDate, 400);

  const hasFilter = search || fromDate || toDate;

  // Reset page khi filter thay đổi
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedFrom, debouncedTo]);

  // Clamp: from/to phải nằm trong cycleStart–cycleEnd
  const effectiveFrom = debouncedFrom
    ? new Date(
        Math.max(new Date(debouncedFrom).getTime(), new Date(cycleStart).getTime()),
      ).toISOString()
    : cycleStart;
  const effectiveTo = debouncedTo
    ? new Date(
        Math.min(new Date(`${debouncedTo}T23:59:59Z`).getTime(), new Date(cycleEnd).getTime()),
      ).toISOString()
    : cycleEnd;

  const params = new URLSearchParams({
    cycleStart: effectiveFrom,
    cycleEnd: effectiveTo,
    limit: String(LIMIT),
    page: String(page),
  });
  if (debouncedSearch) params.set('search', debouncedSearch);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'cycle-transactions', effectiveFrom, effectiveTo, debouncedSearch, page],
    queryFn: () =>
      api
        .get<{ data: { items: CycleTransaction[]; total: number; page: number; limit: number } }>(
          `/billing/cycle-transactions?${params.toString()}`,
        )
        .then((r) => r.data.data),
    enabled: open,
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Giao dịch trong chu kỳ hiện tại</DialogTitle>
          <DialogDescription>
            {formatDateVN(cycleStart)} — {formatDateVN(cycleEnd)} · Giao dịch đã tính quota
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo nội dung, số tài khoản..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={fromDate}
              min={cycleStart.slice(0, 10)}
              max={toDate || cycleEnd.slice(0, 10)}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="date"
              value={toDate}
              min={fromDate || cycleStart.slice(0, 10)}
              max={cycleEnd.slice(0, 10)}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 w-36 text-xs"
            />
          </div>
          {hasFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs text-muted-foreground px-2"
              onClick={() => {
                setSearch('');
                setFromDate('');
                setToDate('');
              }}
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-md border min-h-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Search className="size-8 opacity-30" />
              <p className="text-sm">Không tìm thấy giao dịch nào</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Ngày</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nội dung</th>
                  <th className="px-4 py-2.5 text-left font-medium">Nguồn</th>
                  <th className="px-4 py-2.5 text-right font-medium">Số tiền</th>
                  <th className="px-4 py-2.5 text-left font-medium">Định khoản</th>
                  <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateVN(tx.transactionDate)}
                    </td>
                    <td className="px-4 py-3 max-w-[240px]">
                      <p className="truncate text-xs">{tx.content || '—'}</p>
                      {tx.senderAccount && (
                        <p className="text-[11px] text-muted-foreground font-mono truncate">
                          {tx.senderAccount}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <TransactionSourceBadge source={tx.source} size="md" />
                    </td>
                    <td
                      className={cn(
                        'px-4 py-3 text-right font-medium text-sm whitespace-nowrap',
                        tx.amount >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400',
                      )}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {formatVND(tx.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {tx.classification
                        ? `Nợ ${tx.classification.debitAccount ?? '?'} / Có ${tx.classification.creditAccount ?? '?'}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {tx.classification ? (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                            tx.classification.status === 'classified'
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
                              : tx.classification.status === 'review'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800'
                                : 'bg-muted text-muted-foreground border-border',
                          )}
                        >
                          {tx.classification.status === 'classified'
                            ? 'Đã định khoản'
                            : tx.classification.status === 'review'
                              ? 'Chờ duyệt'
                              : tx.classification.status === 'skipped'
                                ? 'Bỏ qua'
                                : 'Chờ xử lý'}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Chưa định khoản</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1 border-t">
            <p className="text-xs text-muted-foreground">
              {data?.total ?? 0} kết quả · Trang {page}/{totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="size-7"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
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

// ─── Tab Audit Log ────────────────────────────────────────────────
function AuditLogTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText className="size-4" />
          Nhật ký hoạt động
        </CardTitle>
        <CardDescription>
          Lịch sử thao tác trong doanh nghiệp — định khoản, liên kết ngân hàng, thanh toán...
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuditLogPanel endpoint="/audit-logs" />
      </CardContent>
    </Card>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin';
  const canViewAudit = user?.role === 'admin' || user?.role === 'accountant';
  const activeTab = searchParams.get('tab') ?? 'banking';

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
    {
      value: 'audit',
      label: 'Nhật ký',
      icon: ScrollText,
      auditOnly: true,
      component: <AuditLogTab />,
    },
    { value: 'billing', label: 'Gói dịch vụ', icon: CreditCard, component: <BillingTab /> },
    {
      value: 'copilot-history',
      label: 'Lịch sử Copilot',
      icon: MessageSquare,
      component: <CopilotHistoryTab />,
    },
  ];

  return (
    <>
      <Header title="Cài đặt" description="Quản lý tài khoản và cấu hình hệ thống" />
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <Tabs
          value={activeTab}
          onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
        >
          <TabsList className="w-full justify-start gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const locked = (tab.adminOnly && !isAdmin) || (tab.auditOnly && !canViewAudit);
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={locked}
                  className="gap-1.5"
                  title={tab.label}
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">{tab.label}</span>
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
