import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@xcash/shared-types';
import { RolesGuard } from '../../common/guards/auth.guards';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  // Helper: mock IS_PUBLIC_KEY = false, ROLES_KEY = roles
  function mockNonPublic(roles: unknown) {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // IS_PUBLIC_KEY
      .mockReturnValueOnce(roles); // ROLES_KEY
  }

  it('skips all checks for public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true); // IS_PUBLIC_KEY = true
    const context = createMockContext({ role: Role.CAS_PARTNER, tenantId: null });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when no roles are required', () => {
    mockNonPublic(undefined);
    const context = createMockContext({ role: Role.VIEWER, tenantId: 'tenant-1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks cas_partner even when no roles are required', () => {
    mockNonPublic(undefined);
    const context = createMockContext({ role: Role.CAS_PARTNER, tenantId: null });
    expect(() => guard.canActivate(context)).toThrow(
      'Cas Partner không được truy cập API nghiệp vụ tenant',
    );
  });

  it('allows admin when admin role is required', () => {
    mockNonPublic([Role.ADMIN]);
    const context = createMockContext({ role: Role.ADMIN, tenantId: 'tenant-1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks viewer when admin role is required', () => {
    mockNonPublic([Role.ADMIN]);
    const context = createMockContext({ role: Role.VIEWER, tenantId: 'tenant-1' });
    expect(() => guard.canActivate(context)).toThrow('Bạn không có quyền thực hiện thao tác này');
  });

  it('blocks cas_partner from tenant business routes', () => {
    mockNonPublic([Role.ADMIN]);
    const context = createMockContext({ role: Role.CAS_PARTNER, tenantId: null });
    expect(() => guard.canActivate(context)).toThrow(
      'Cas Partner không được truy cập API nghiệp vụ tenant',
    );
  });
});

function createMockContext(user: Partial<AuthenticatedUser>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test',
          ...user,
        },
      }),
    }),
  } as never;
}
