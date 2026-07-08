import type { SubscriptionPlan } from '@xcash/shared-types';
import { formatVND } from '@/lib/format-vnd';
import { formatTransactionQuota, PLAN_LABEL } from '@/lib/plan';
import type { BillingPlan } from '@/types/api/billing';

export const PLAN_FEATURES: Record<string, string[]> = {
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

export const PLAN_ORDER = ['free', 'starter', 'pro', 'enterprise'];

export const ORDER_TYPE_LABEL: Record<string, string> = {
  upgrade: 'Nâng cấp gói',
  overage: 'Vượt quota',
};

export interface PlanFeatureLine {
  text: string;
  inherited?: boolean;
}

export function getPlanFeatureLines(plan: string): PlanFeatureLine[] {
  const index = PLAN_ORDER.indexOf(plan);
  const own = (PLAN_FEATURES[plan] ?? []).map((text) => ({ text }));
  if (index <= 0) return own;
  const prev = PLAN_ORDER[index - 1];
  return [
    { text: `Mọi tính năng gói ${PLAN_LABEL[prev as SubscriptionPlan] ?? prev}`, inherited: true },
    ...own,
  ];
}

export function formatPlanQuotaSubtitle(plan: BillingPlan): string {
  const quota = formatTransactionQuota(plan.transactionQuota);
  if (plan.overagePricePerTransaction != null) {
    return `${quota} · Phí vượt ${formatVND(plan.overagePricePerTransaction)}/GD`;
  }
  return quota;
}
