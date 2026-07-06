export const AUDIT_ACTION_LABELS: Record<string, string> = {
  tenant_registered: 'Đăng ký doanh nghiệp',
  banking_linked: 'Liên kết ngân hàng',
  webhook_received: 'Nhận giao dịch từ webhook',
  ai_auto_classify: 'AI tự động định khoản',
  ai_queued_review: 'AI đưa vào hàng chờ review',
  review_confirmed: 'Xác nhận định khoản',
  review_corrected: 'Sửa định khoản',
  review_skipped: 'Bỏ qua review',
  subscription_upgraded: 'Nâng cấp gói dịch vụ',
  overage_paid: 'Thanh toán phí vượt quota',
  tenant_suspended: 'Khóa doanh nghiệp',
  tenant_activated: 'Mở khóa doanh nghiệp',
  partner_set_plan: 'Partner đặt gói',
  plan_pricing_updated: 'Cập nhật giá gói dịch vụ',
  transaction_import: 'Import giao dịch từ Excel',
};

export const AUDIT_ENTITY_TYPE_LABELS: Record<string, string> = {
  tenant: 'Doanh nghiệp',
  cas_grant: 'Liên kết ngân hàng',
  transaction: 'Giao dịch',
  transaction_classification: 'Định khoản',
  subscription: 'Gói dịch vụ',
  payment_order: 'Thanh toán',
  plan_pricing: 'Bảng giá gói',
};

export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export function getAuditEntityTypeLabel(entityType: string): string {
  return AUDIT_ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isAuditActorUserId(actor: string): boolean {
  return UUID_REGEX.test(actor);
}

export function getStaticActorLabel(actor: string): string | null {
  if (actor === 'system') return 'Hệ thống';
  if (actor === 'ai') return 'AI';
  if (actor === 'cas_partner') return 'Cas Partner';
  return null;
}
