export type {
  AiCostBreakdownItem,
  AiCostDetailLog,
  AiCostDetailResponse,
  AiCostRow,
  AiCostsResponse,
  DashboardStats,
  PartnerPayment,
  PartnerTenant,
  PartnerTenantsResponse,
  PaymentsResponse,
  PlanPricingItem,
  RevenueTrendPoint,
  TenantDetail,
  TenantMember,
} from '@xcash/shared-types';

/** @deprecated Use DashboardStats instead. */
export interface TenantStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  aiAccuracy: number;
}
