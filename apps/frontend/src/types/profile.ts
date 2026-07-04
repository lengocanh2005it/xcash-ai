import type { Role, SubscriptionPlan } from '@xcash/shared-types';
import type { AuthenticatedUser } from '@/types/auth';

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

export function profileToAuthUser(profile: UserProfile): AuthenticatedUser {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.avatarUrl,
    role: profile.role,
    tenantId: profile.tenantId,
    businessName: profile.businessName,
    plan: profile.plan,
  };
}
