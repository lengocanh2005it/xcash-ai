import { NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationDeliveryService } from './notification-delivery.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const deliveryService = {
    enqueueEmailIfEnabled: jest.fn().mockResolvedValue(undefined),
    sendSlackIfEnabled: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    notification: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationDeliveryService, useValue: deliveryService },
        { provide: JwtService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  it('lists notifications scoped to tenant and user', async () => {
    const items = [
      {
        id: 'n1',
        type: NotificationType.review_needed,
        title: 'Giao dịch mới cần review',
        body: 'Test',
        link: '/review',
        readAt: null,
        createdAt: new Date(),
      },
    ];
    prisma.notification.findMany.mockResolvedValue(items);
    prisma.notification.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

    const result = await service.list('tenant-1', 'user-1', 1, 20);

    expect(result.items).toEqual(items);
    expect(result.total).toBe(1);
    expect(result.unreadCount).toBe(1);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          OR: [{ userId: null }, { userId: 'user-1' }],
        }),
      }),
    );
  });

  it('marks a notification as read', async () => {
    const notification = {
      id: 'n1',
      type: NotificationType.review_needed,
      title: 'Giao dịch mới cần review',
      body: 'Test',
      link: '/review',
      readAt: null,
      createdAt: new Date(),
    };
    const updated = { ...notification, readAt: new Date() };

    prisma.notification.findFirst.mockResolvedValue(notification);
    prisma.notification.update.mockResolvedValue(updated);

    const result = await service.markRead('tenant-1', 'user-1', 'n1');

    expect(result.readAt).toBeTruthy();
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { readAt: expect.any(Date) },
    });
  });

  it('throws when notification not found', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.markRead('tenant-1', 'user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates review_needed notification for tenant', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.createReviewNeeded('tenant-1', 'txn-1', 'Thanh toan hoa don dien', 72);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: null,
        type: NotificationType.review_needed,
        title: 'Giao dịch mới cần review',
        link: '/review',
        body: expect.stringContaining('72%'),
      }),
    });
    expect(deliveryService.enqueueEmailIfEnabled).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ title: 'Giao dịch mới cần review' }),
    );
  });

  it('creates quota warning only once per cycle', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.createQuotaWarning('tenant-1', 40, 50, new Date('2026-07-01'));

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.quota_warning,
        link: '/settings?tab=billing',
      }),
    });

    prisma.notification.findFirst.mockResolvedValue({ id: 'existing' });
    prisma.notification.create.mockClear();

    await service.createQuotaWarning('tenant-1', 41, 50, new Date('2026-07-01'));

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('creates billing success notification', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.createBillingSuccess('tenant-1', 'upgrade', 'starter', 299000, 500);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.billing_success,
        title: 'Mua gói Starter thành công',
        body: expect.stringContaining('Starter'),
      }),
    });
  });

  it('creates plan activated notification when partner sets plan', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.createPlanActivatedByPartner('tenant-1', 'pro', 2000);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.billing_success,
        title: 'Gói Pro đã được kích hoạt',
        body: expect.stringContaining('2.000'),
      }),
    });
  });

  it('creates tenant suspended notification', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.createTenantSuspended('tenant-1');

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.tenant_suspended,
        link: null,
      }),
    });
  });

  it('deletes a single notification scoped to tenant and user', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.remove('tenant-1', 'user-1', 'n1');

    expect(result.deleted).toBe(1);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'n1',
        tenantId: 'tenant-1',
        OR: [{ userId: null }, { userId: 'user-1' }],
      }),
    });
  });

  it('throws when deleting a notification that does not exist', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('tenant-1', 'user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('deletes many notifications by ids', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 2 });

    const result = await service.removeMany('tenant-1', 'user-1', ['n1', 'n2']);

    expect(result.deleted).toBe(2);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['n1', 'n2'] },
        tenantId: 'tenant-1',
      }),
    });
  });

  it('returns zero without querying when removeMany gets empty ids', async () => {
    const result = await service.removeMany('tenant-1', 'user-1', []);

    expect(result.deleted).toBe(0);
    expect(prisma.notification.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes all notifications for tenant and user', async () => {
    prisma.notification.deleteMany.mockResolvedValue({ count: 5 });

    const result = await service.removeAll('tenant-1', 'user-1');

    expect(result.deleted).toBe(5);
    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-1',
        OR: [{ userId: null }, { userId: 'user-1' }],
      }),
    });
  });
});
