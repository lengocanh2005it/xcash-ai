import { Role } from '@xcash/shared-types';

// ─── Role checks ──────────────────────────────────────────────────────────────

export function isAdmin(role?: Role | string | null): boolean {
  return role === Role.ADMIN;
}

export function isAccountant(role?: Role | string | null): boolean {
  return role === Role.ACCOUNTANT;
}

export function isViewer(role?: Role | string | null): boolean {
  return role === Role.VIEWER;
}

export function isCasPartner(role?: Role | string | null): boolean {
  return role === Role.CAS_PARTNER;
}

// ─── Permission checks ────────────────────────────────────────────────────────

/** Admin hoặc Accountant — thao tác nghiệp vụ (review, reclassify, import). */
export function canManageTransactions(role?: Role | string | null): boolean {
  return role === Role.ADMIN || role === Role.ACCOUNTANT;
}

/** Xem tab Billing + gọi GET /billing/*. */
export function canViewBilling(role?: Role | string | null): boolean {
  return role === Role.ADMIN || role === Role.ACCOUNTANT;
}

/** Xem tab Banking trong Settings. */
export function canViewBankingSettings(role?: Role | string | null): boolean {
  return role === Role.ADMIN || role === Role.ACCOUNTANT;
}

/** Xem tab Ngưỡng AI (chỉ Admin được sửa). */
export function canViewThreshold(role?: Role | string | null): boolean {
  return canManageTransactions(role);
}

export function canViewAuditLogs(role?: Role | string | null): boolean {
  return role === Role.ADMIN || role === Role.ACCOUNTANT;
}

/** Nâng cấp gói / thanh toán (chỉ Admin). */
export function canManageBilling(role?: Role | string | null): boolean {
  return role === Role.ADMIN;
}

/** Nhập Excel giao dịch. */
export function canImportTransactions(role?: Role | string | null): boolean {
  return canManageTransactions(role);
}

/** Định khoản lại hàng loạt. */
export function canBulkReclassify(role?: Role | string | null): boolean {
  return canManageTransactions(role);
}

// ─── Route access ─────────────────────────────────────────────────────────────

type TenantRole = 'admin' | 'accountant' | 'viewer';

const ROUTE_ACCESS: Record<string, TenantRole[]> = {
  '/dashboard': ['admin', 'accountant', 'viewer'],
  '/transactions': ['admin', 'accountant', 'viewer'],
  '/review': ['admin', 'accountant', 'viewer'],
  '/reports': ['admin', 'accountant', 'viewer'],
  '/analytics': ['admin', 'accountant', 'viewer'],
  '/settings': ['admin', 'accountant', 'viewer'],
  '/settings/billing': ['admin', 'accountant', 'viewer'],
  '/settings/banking': ['admin', 'accountant'],
  '/settings/team': ['admin', 'accountant'],
  '/settings/threshold': ['admin', 'accountant'],
  '/settings/audit': ['admin', 'accountant'],
  '/copilot': ['admin', 'accountant', 'viewer'],
};

/**
 * Kiểm tra role có quyền truy cập route không.
 * Trả về true nếu route không có trong danh sách (open by default).
 */
export function canAccessRoute(role?: Role | string | null, pathname?: string): boolean {
  if (!pathname) return true;
  if (isCasPartner(role)) return false;

  const allowed = ROUTE_ACCESS[pathname];
  if (!allowed) return true;

  const roleLower = (role ?? '').toLowerCase() as TenantRole;
  return allowed.includes(roleLower);
}
