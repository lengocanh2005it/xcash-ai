export interface PartnerTenant {
  id: string;
  businessName: string;
  createdAt: string;
  plan: string | null;
  status: string;
  transactionsThisMonth: number;
  revenuePerMonth: number;
}

export interface PartnerTenantsResponse {
  items: PartnerTenant[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
