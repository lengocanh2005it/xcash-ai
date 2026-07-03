import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';
import { meetsPlan } from '../../common/util/plan.util';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { UpdateNotificationsDto, UpdateThresholdDto } from './dto/settings.dto';

export interface NotificationConfig {
  emailEnabled: boolean;
  email: string | null;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getThreshold(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { classificationThreshold: true },
    });
    if (!tenant) throw new NotFoundException('Tenant không tồn tại');
    return { threshold: tenant.classificationThreshold };
  }

  async updateThreshold(tenantId: string, dto: UpdateThresholdDto) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { classificationThreshold: dto.threshold },
      select: { classificationThreshold: true },
    });
    return { threshold: tenant.classificationThreshold };
  }

  async getNotifications(tenantId: string): Promise<NotificationConfig> {
    const raw = await this.redis.client.get(`settings:notifications:${tenantId}`);
    if (!raw) {
      return { emailEnabled: false, email: null, slackEnabled: false, slackWebhookUrl: null };
    }
    return JSON.parse(raw) as NotificationConfig;
  }

  async updateNotifications(
    tenantId: string,
    dto: UpdateNotificationsDto,
  ): Promise<NotificationConfig> {
    // Thông báo Email cần gói Starter+, Slack cần gói Pro+
    if (dto.emailEnabled || dto.slackEnabled) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId, status: 'active' },
        orderBy: { startedAt: 'desc' },
        select: { plan: true },
      });
      const plan: SubscriptionPlan | null = subscription?.plan ?? null;
      if (dto.emailEnabled && !meetsPlan(plan, 'starter')) {
        throw new ForbiddenException('Thông báo Email yêu cầu gói Starter trở lên.');
      }
      if (dto.slackEnabled && !meetsPlan(plan, 'pro')) {
        throw new ForbiddenException('Thông báo Slack yêu cầu gói Pro trở lên.');
      }
    }

    const config: NotificationConfig = {
      emailEnabled: dto.emailEnabled,
      email: dto.email ?? null,
      slackEnabled: dto.slackEnabled,
      slackWebhookUrl: dto.slackWebhookUrl ?? null,
    };
    await this.redis.client.set(`settings:notifications:${tenantId}`, JSON.stringify(config));
    return config;
  }
}
