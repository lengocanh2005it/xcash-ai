import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlan } from '@prisma/client';
import { NotificationService } from '../../modules/notification/notification.service';
import { QuotaNotificationService } from './quota-notification.service';

describe('QuotaNotificationService', () => {
  let service: QuotaNotificationService;
  let notificationService: {
    createQuotaWarning: jest.Mock;
    createQuotaExceeded: jest.Mock;
    createOverageStarted: jest.Mock;
  };

  beforeEach(async () => {
    notificationService = {
      createQuotaWarning: jest.fn().mockResolvedValue(undefined),
      createQuotaExceeded: jest.fn().mockResolvedValue(undefined),
      createOverageStarted: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotaNotificationService,
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = module.get<QuotaNotificationService>(QuotaNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkAndNotify', () => {
    const baseParams = {
      tenantId: 'tenant-1',
      quota: 100,
      plan: SubscriptionPlan.starter,
      overagePricePerTransaction: 800,
      cycleStart: new Date('2026-07-01'),
    };

    it('should send warning when crossing 80% threshold', async () => {
      await service.checkAndNotify({ ...baseParams, oldUsed: 79, added: 1 });

      expect(notificationService.createQuotaWarning).toHaveBeenCalledWith(
        'tenant-1',
        80,
        100,
        expect.any(Date),
      );
      expect(notificationService.createQuotaExceeded).not.toHaveBeenCalled();
      expect(notificationService.createOverageStarted).not.toHaveBeenCalled();
    });

    it('should not send warning if already above threshold', async () => {
      await service.checkAndNotify({ ...baseParams, oldUsed: 85, added: 1 });

      expect(notificationService.createQuotaWarning).not.toHaveBeenCalled();
    });

    it('should send exceeded when crossing 100% threshold', async () => {
      await service.checkAndNotify({ ...baseParams, oldUsed: 99, added: 1 });

      expect(notificationService.createQuotaExceeded).toHaveBeenCalledWith(
        'tenant-1',
        100,
        expect.any(Date),
      );
    });

    it('should not send exceeded if already above quota', async () => {
      await service.checkAndNotify({ ...baseParams, oldUsed: 105, added: 1 });

      expect(notificationService.createQuotaExceeded).not.toHaveBeenCalled();
    });

    it('should send overage started when crossing quota on overage plan', async () => {
      await service.checkAndNotify({ ...baseParams, oldUsed: 100, added: 1 });

      expect(notificationService.createOverageStarted).toHaveBeenCalledWith(
        'tenant-1',
        800,
        expect.any(Date),
      );
    });

    it('should not send overage on free plan', async () => {
      await service.checkAndNotify({
        ...baseParams,
        plan: SubscriptionPlan.free,
        oldUsed: 49,
        added: 1,
      });

      expect(notificationService.createOverageStarted).not.toHaveBeenCalled();
    });

    it('should not send overage when price is 0', async () => {
      await service.checkAndNotify({
        ...baseParams,
        overagePricePerTransaction: 0,
        oldUsed: 100,
        added: 1,
      });

      expect(notificationService.createOverageStarted).not.toHaveBeenCalled();
    });

    it('should not send overage when price is null', async () => {
      await service.checkAndNotify({
        ...baseParams,
        overagePricePerTransaction: null,
        oldUsed: 100,
        added: 1,
      });

      expect(notificationService.createOverageStarted).not.toHaveBeenCalled();
    });

    it('should send both warning and exceeded when batch crosses both thresholds', async () => {
      await service.checkAndNotify({ ...baseParams, oldUsed: 75, added: 30 });

      expect(notificationService.createQuotaWarning).toHaveBeenCalledWith(
        'tenant-1',
        105,
        100,
        expect.any(Date),
      );
      expect(notificationService.createQuotaExceeded).toHaveBeenCalledWith(
        'tenant-1',
        100,
        expect.any(Date),
      );
    });

    it('should not throw on notification error', async () => {
      notificationService.createQuotaWarning.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.checkAndNotify({ ...baseParams, oldUsed: 79, added: 1 }),
      ).resolves.toBeUndefined();
    });
  });
});
