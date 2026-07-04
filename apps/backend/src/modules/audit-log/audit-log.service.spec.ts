import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;

  const prisma = {
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditLogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AuditLogService);
  });

  it('lists tenant audit logs with labels', async () => {
    const createdAt = new Date('2026-07-04T10:00:00.000Z');
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        tenantId: 'tenant-1',
        entityType: 'transaction_classification',
        entityId: 'cls-1',
        action: 'review_confirmed',
        actor: '11111111-1111-4111-8111-111111111111',
        beforeState: null,
        afterState: { action: 'confirm' },
        createdAt,
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      { id: '11111111-1111-4111-8111-111111111111', name: 'Kế toán A', email: 'a@x.vn' },
    ]);

    const result = await service.listForTenant('tenant-1', { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      actionLabel: 'Xác nhận định khoản',
      actorLabel: 'Kế toán A',
      entityTypeLabel: 'Định khoản',
    });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1' }),
      }),
    );
  });

  it('lists partner audit logs with business name', async () => {
    const createdAt = new Date('2026-07-04T10:00:00.000Z');
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-2',
        tenantId: 'tenant-1',
        entityType: 'tenant',
        entityId: 'tenant-1',
        action: 'tenant_suspended',
        actor: '22222222-2222-4222-8222-222222222222',
        beforeState: null,
        afterState: null,
        createdAt,
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', name: 'Cas Partner', email: 'p@x.vn' },
    ]);
    prisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1', businessName: 'ABC Corp' }]);

    const result = await service.listForPartner({ page: 1, limit: 20 });

    expect(result.items[0]).toMatchObject({
      businessName: 'ABC Corp',
      actionLabel: 'Khóa doanh nghiệp',
      actorLabel: 'Cas Partner',
    });
  });
});
