import type { Role } from '@paypilot/shared-types';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string | null;
}
