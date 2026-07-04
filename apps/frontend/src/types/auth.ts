import type { Role, SubscriptionPlan } from '@xcash/shared-types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  tenantId: string | null;
  businessName: string | null;
  plan: SubscriptionPlan | null;
}
