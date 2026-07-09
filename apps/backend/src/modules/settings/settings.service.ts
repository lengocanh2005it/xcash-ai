import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SubscriptionPlan } from '@prisma/client';
import { meetsPlan } from '../../common/util/plan.util';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { UpdateNotificationsDto, UpdateThresholdDto } from './dto/settings.dto';

export interface NotificationConfig {
  emailEnabled: boolean;
  email: string | null;
  monthlyReportEnabled: boolean;
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
      return {
        emailEnabled: false,
        email: null,
        monthlyReportEnabled: false,
        slackEnabled: false,
        slackWebhookUrl: null,
      };
    }
    return JSON.parse(raw) as NotificationConfig;
  }

  async updateNotifications(
    tenantId: string,
    dto: UpdateNotificationsDto,
  ): Promise<NotificationConfig> {
    // Thông báo Email cần gói Starter+, Slack cần gói Pro+
    if (dto.emailEnabled || dto.slackEnabled || dto.monthlyReportEnabled) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId, status: 'active' },
        orderBy: { startedAt: 'desc' },
        select: { plan: true },
      });
      const plan: SubscriptionPlan | null = subscription?.plan ?? null;
      if (dto.emailEnabled && !meetsPlan(plan, 'starter')) {
        throw new ForbiddenException('Thông báo Email yêu cầu gói Starter trở lên.');
      }
      if (dto.monthlyReportEnabled && !meetsPlan(plan, 'starter')) {
        throw new ForbiddenException('Email báo cáo hàng tháng yêu cầu gói Starter trở lên.');
      }
      if (dto.slackEnabled && !meetsPlan(plan, 'pro')) {
        throw new ForbiddenException('Thông báo Slack yêu cầu gói Pro trở lên.');
      }
    }

    const config: NotificationConfig = {
      emailEnabled: dto.emailEnabled,
      email: dto.email ?? null,
      monthlyReportEnabled: dto.monthlyReportEnabled,
      slackEnabled: dto.slackEnabled,
      slackWebhookUrl: dto.slackWebhookUrl ?? null,
    };
    await this.redis.client.set(`settings:notifications:${tenantId}`, JSON.stringify(config));
    return config;
  }

  async testSlackWebhook(webhookUrl: string): Promise<void> {
    let res: Response;
    try {
      res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '[X-Cash AI] Kiểm tra kết nối Slack thành công ✓' }),
      });
    } catch {
      throw new BadRequestException('Không thể kết nối đến Slack webhook URL.');
    }

    if (!res.ok) {
      throw new BadRequestException(`Slack webhook không hợp lệ (HTTP ${res.status}).`);
    }
  }
}
