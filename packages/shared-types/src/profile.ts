import type { Role, SubscriptionPlan } from './generated/enums';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  tenantId: string | null;
  businessName: string | null;
  ownerName: string | null;
  plan: SubscriptionPlan | null;
}

export interface UpdateProfileInput {
  name?: string;
  businessName?: string;
}
