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

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ role: Role.VIEWER, tenantId: 'tenant-1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows admin when admin role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.ADMIN, tenantId: 'tenant-1' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks viewer when admin role is required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const context = createMockContext({ role: Role.VIEWER, tenantId: 'tenant-1' });
    expect(() => guard.canActivate(context)).toThrow('Bạn không có quyền thực hiện thao tác này');
  });

  it('blocks cas_partner from tenant business routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
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
