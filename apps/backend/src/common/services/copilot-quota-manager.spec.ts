import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlan } from '@prisma/client';
import { NotificationService } from '../../modules/notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CopilotQuotaManager } from './copilot-quota-manager';

describe('CopilotQuotaManager', () => {
  let service: CopilotQuotaManager;
  let prisma: {
    subscription: { update: jest.Mock };
    planPricing: { findUnique: jest.Mock };
  };
  let notificationService: { checkCopilotQuotaNotifications: jest.Mock };

  beforeEach(async () => {
    prisma = {
      subscription: { update: jest.fn() },
      planPricing: { findUnique: jest.fn() },
    };
    notificationService = {
      checkCopilotQuotaNotifications: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopilotQuotaManager,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<CopilotQuotaManager>(CopilotQuotaManager);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('incrementAndNotify', () => {
    it('should no-op when subscriptionId is undefined', async () => {
      await service.incrementAndNotify(undefined, 'tenant-1');

      expect(prisma.subscription.update).not.toHaveBeenCalled();
      expect(notificationService.checkCopilotQuotaNotifications).not.toHaveBeenCalled();
    });

    it('should increment copilotUsedThisCycle and fire notification', async () => {
      prisma.subscription.update.mockResolvedValue({
        copilotUsedThisCycle: 5,
        currentCycleStart: new Date('2026-07-01'),
        plan: SubscriptionPlan.starter,
      });
      prisma.planPricing.findUnique.mockResolvedValue({ copilotQuota: 200 });

      await service.incrementAndNotify('sub-1', 'tenant-1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { copilotUsedThisCycle: { increment: 1 } },
        select: { copilotUsedThisCycle: true, currentCycleStart: true, plan: true },
      });

      expect(prisma.planPricing.findUnique).toHaveBeenCalledWith({
        where: { plan: SubscriptionPlan.starter },
        select: { copilotQuota: true },
      });

      expect(notificationService.checkCopilotQuotaNotifications).toHaveBeenCalledWith(
        'tenant-1',
        5,
        200,
        expect.any(Date),
      );
    });

    it('should use default quota of -1 when planPricing is null', async () => {
      prisma.subscription.update.mockResolvedValue({
        copilotUsedThisCycle: 1,
        currentCycleStart: new Date('2026-07-01'),
        plan: SubscriptionPlan.free,
      });
      prisma.planPricing.findUnique.mockResolvedValue(null);

      await service.incrementAndNotify('sub-1', 'tenant-1');

      expect(notificationService.checkCopilotQuotaNotifications).toHaveBeenCalledWith(
        'tenant-1',
        1,
        -1,
        expect.any(Date),
      );
    });

    it('should not throw when Prisma update fails', async () => {
      prisma.subscription.update.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.incrementAndNotify('sub-1', 'tenant-1')).resolves.not.toThrow();
    });

    it('should not throw when notification fails', async () => {
      prisma.subscription.update.mockResolvedValue({
        copilotUsedThisCycle: 10,
        currentCycleStart: new Date('2026-07-01'),
        plan: SubscriptionPlan.starter,
      });
      prisma.planPricing.findUnique.mockResolvedValue({ copilotQuota: 200 });
      // notification is fire-and-forget, so checkCopilotQuotaNotifications won't reject
      // but if it did, the catch should swallow it
      notificationService.checkCopilotQuotaNotifications.mockRejectedValue(
        new Error('Notification failed'),
      );

      await expect(service.incrementAndNotify('sub-1', 'tenant-1')).resolves.not.toThrow();
    });
  });
});
