import type { AuthenticatedUser, UserProfile } from '@xcash/shared-types';

export type { UpdateProfileInput, UserProfile } from '@xcash/shared-types';

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
