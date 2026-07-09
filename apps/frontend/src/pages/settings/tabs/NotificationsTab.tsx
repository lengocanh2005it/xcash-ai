import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SubscriptionPlan } from '@xcash/shared-types';
import { Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/useAuth';
import { getApiData, postApiData, putApiData } from '@/lib/api';
import { hasPlanAccess, PLAN_LABEL } from '@/lib/plan';

function SlackWebhookInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { mutate: test, isPending } = useMutation({
    mutationFn: () => postApiData('/settings/notifications/test-slack', { webhookUrl: value }),
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

export function NotificationsTab() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canEmail = hasPlanAccess(user?.plan, SubscriptionPlan.STARTER);
  const canSlack = hasPlanAccess(user?.plan, SubscriptionPlan.PRO);
  const allLocked = !canEmail && !canSlack;
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notifications'],
    queryFn: () =>
      getApiData<{
        emailEnabled: boolean;
        email: string | null;
        monthlyReportEnabled: boolean;
        monthlyReportEmail: string | null;
        slackEnabled: boolean;
        slackWebhookUrl: string | null;
      }>('/settings/notifications'),
  });

  const [form, setForm] = useState({
    emailEnabled: false,
    email: '',
    monthlyReportEnabled: false,
    monthlyReportEmail: '',
    slackEnabled: false,
    slackWebhookUrl: '',
  });

  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!data || synced) return;
    setForm({
      emailEnabled: data.emailEnabled,
      email: data.email ?? '',
      monthlyReportEnabled: data.monthlyReportEnabled,
      monthlyReportEmail: data.monthlyReportEmail ?? '',
      slackEnabled: data.slackEnabled,
      slackWebhookUrl: data.slackWebhookUrl ?? '',
    });
    setSynced(true);
  }, [data, synced]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => putApiData('/settings/notifications', form),
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
        <CardDescription>Cấu hình kênh và tần suất nhận thông báo.</CardDescription>
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
              <p className="text-xs text-muted-foreground">Nhận email khi có giao dịch mới</p>
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
                Báo cáo hàng tháng
                {!canEmail && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Lock className="size-2.5" /> Gói {PLAN_LABEL[SubscriptionPlan.STARTER]}+
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Nhận email tổng kết tài chính vào ngày 1 hàng tháng
              </p>
            </div>
            <Switch
              checked={form.monthlyReportEnabled}
              disabled={!canEmail}
              onCheckedChange={(v) => setForm((f) => ({ ...f, monthlyReportEnabled: v }))}
            />
          </div>
          {canEmail && form.monthlyReportEnabled && (
            <Input
              placeholder="email@company.com"
              value={form.monthlyReportEmail}
              onChange={(e) => setForm((f) => ({ ...f, monthlyReportEmail: e.target.value }))}
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
