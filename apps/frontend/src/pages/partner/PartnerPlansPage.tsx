import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
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
import { api } from '@/lib/api';
import { formatVND } from '@/lib/format-vnd';

interface PlanPricing {
  plan: string;
  pricePerMonth: number;
  transactionQuota: number;
  overagePricePerTransaction: number | null;
  editable: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  free: 'Dùng thử, 50 GD/tháng, không tính phí',
  starter: 'Phù hợp SME nhỏ, AI Copilot, Analytics',
  pro: 'Doanh nghiệp tăng trưởng, RAG Knowledge Base, Export Excel',
  enterprise: 'Không giới hạn GD, SLA, Partner support riêng',
};

export default function PartnerPlansPage() {
  const queryClient = useQueryClient();
  const [editingPlan, setEditingPlan] = useState<PlanPricing | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [quotaInput, setQuotaInput] = useState('');
  const [overageInput, setOverageInput] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: planPricing, isLoading: loadingPricing } = useQuery({
    queryKey: ['partner', 'plan-pricing'],
    queryFn: () =>
      api.get<{ data: PlanPricing[] }>('/partner/plan-pricing').then((r) => r.data.data),
  });

  const updatePricingMutation = useMutation({
    mutationFn: (payload: {
      plan: string;
      pricePerMonth: number;
      transactionQuota: number;
      overagePricePerTransaction: number | null;
    }) =>
      api.patch(`/partner/plan-pricing/${payload.plan}`, {
        pricePerMonth: payload.pricePerMonth,
        transactionQuota: payload.transactionQuota,
        overagePricePerTransaction: payload.overagePricePerTransaction ?? undefined,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật giá gói');
      setEditingPlan(null);
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['partner', 'plan-pricing'] });
    },
    onError: () => toast.error('Không thể cập nhật giá gói'),
  });

  const openEdit = (plan: PlanPricing) => {
    setEditingPlan(plan);
    setPriceInput(String(plan.pricePerMonth));
    setQuotaInput(String(plan.transactionQuota));
    setOverageInput(
      plan.overagePricePerTransaction != null ? String(plan.overagePricePerTransaction) : '',
    );
  };

  const handleSubmit = () => {
    if (!editingPlan) return;
    if (Number.isNaN(Number(priceInput)) || Number.isNaN(Number(quotaInput))) {
      toast.error('Giá trị không hợp lệ');
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!editingPlan) return;
    updatePricingMutation.mutate({
      plan: editingPlan.plan,
      pricePerMonth: Number(priceInput),
      transactionQuota: Number(quotaInput),
      overagePricePerTransaction: overageInput.trim() ? Number(overageInput) : null,
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Gói dịch vụ</h1>
        <p className="text-sm text-muted-foreground">
          Chỉnh giá/quota gói Starter trở lên — áp dụng cho lần nâng cấp tiếp theo, không ảnh hưởng
          gói đang dùng
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loadingPricing
          ? Array.from({ length: 4 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-8 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))
          : (planPricing ?? []).map((p) => (
              <Card key={p.plan} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{PLAN_LABELS[p.plan] ?? p.plan}</CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        {PLAN_DESCRIPTIONS[p.plan] ?? ''}
                      </CardDescription>
                    </div>
                    {!p.editable ? (
                      <span className="mt-0.5 shrink-0 text-xs text-muted-foreground">Cố định</span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      {formatVND(p.pricePerMonth)}
                      <span className="text-sm font-normal text-muted-foreground">/tháng</span>
                    </p>
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      Quota:{' '}
                      <span className="font-medium text-foreground">
                        {p.plan === 'enterprise'
                          ? 'Không giới hạn'
                          : `${p.transactionQuota} GD/tháng`}
                      </span>
                    </p>
                    <p>
                      Phí vượt:{' '}
                      <span className="font-medium text-foreground">
                        {p.overagePricePerTransaction != null
                          ? `${formatVND(p.overagePricePerTransaction)}/GD`
                          : '—'}
                      </span>
                    </p>
                  </div>
                  {p.editable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="size-4" />
                      Chỉnh sửa
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bảng tổng hợp</CardTitle>
          <CardDescription>So sánh giá/quota toàn bộ các gói</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPricing ? (
            <TableSkeleton rows={4} columns={4} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-6 font-medium">Gói</th>
                    <th className="pb-2 pr-6 font-medium">Giá/tháng</th>
                    <th className="pb-2 pr-6 font-medium">Quota GD/tháng</th>
                    <th className="pb-2 pr-6 font-medium">Phí vượt/GD</th>
                    <th className="pb-2 font-medium">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(planPricing ?? []).map((p) => (
                    <tr key={p.plan}>
                      <td className="py-2 pr-6 font-medium">{PLAN_LABELS[p.plan] ?? p.plan}</td>
                      <td className="py-2 pr-6">{formatVND(p.pricePerMonth)}</td>
                      <td className="py-2 pr-6">
                        {p.plan === 'enterprise' ? 'Không giới hạn' : p.transactionQuota}
                      </td>
                      <td className="py-2 pr-6">
                        {p.overagePricePerTransaction != null
                          ? formatVND(p.overagePricePerTransaction)
                          : '—'}
                      </td>
                      <td className="py-2">
                        {p.editable ? (
                          <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                            <Pencil className="size-4" />
                            Sửa
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Cố định</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={editingPlan !== null} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Chỉnh giá gói {editingPlan ? (PLAN_LABELS[editingPlan.plan] ?? editingPlan.plan) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="price">Giá/tháng (đ)</Label>
              <Input
                id="price"
                type="number"
                min={0}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quota">Số giao dịch/tháng</Label>
              <Input
                id="quota"
                type="number"
                min={1}
                value={quotaInput}
                onChange={(e) => setQuotaInput(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overage">
                Phí vượt/giao dịch (đ) — để trống nếu không tính phí vượt
              </Label>
              <Input
                id="overage"
                type="number"
                min={0}
                value={overageInput}
                onChange={(e) => setOverageInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPlan(null)}>
              Hủy
            </Button>
            <Button onClick={handleSubmit} disabled={updatePricingMutation.isPending}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cập nhật giá gói dịch vụ?"
        description={
          editingPlan
            ? `Thay đổi giá/quota gói ${PLAN_LABELS[editingPlan.plan] ?? editingPlan.plan} sẽ áp dụng cho các lần nâng cấp tiếp theo, không ảnh hưởng gói doanh nghiệp đang dùng.`
            : ''
        }
        confirmLabel="Cập nhật"
        loading={updatePricingMutation.isPending}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
