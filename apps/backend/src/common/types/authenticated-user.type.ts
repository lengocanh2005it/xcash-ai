import type { SubscriptionPlan } from '@prisma/client';
import type { Role } from '@xcash/shared-types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  businessName: string | null;
  plan: SubscriptionPlan | null;
}

export interface AuthJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
  businessName: string | null;
  plan: SubscriptionPlan | null;
}
