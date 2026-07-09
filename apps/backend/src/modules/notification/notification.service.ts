import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { paginateParams } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import { NotificationStreamService } from './notification-stream.service';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationListResult {
  items: NotificationItem[];
  unreadCount: number;
  total: number;
}

export interface TransactionEvent {
  type: 'transaction_classified';
  transactionId: string;
  status: 'classified' | 'review';
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly streamService: NotificationStreamService,
  ) {}

  streamForToken(token: string) {
    return this.streamService.streamForToken(token);
  }

  streamTransactionEventsForToken(token: string) {
    return this.streamService.streamTransactionEventsForToken(token);
  }

  emitTransactionClassified(
    tenantId: string,
    transactionId: string,
    status: 'classified' | 'review',
  ): void {
    this.streamService.emitTransactionClassified(tenantId, transactionId, status);
  }

  private userScope(userId: string): Prisma.NotificationWhereInput {
    return {
      OR: [{ userId: null }, { userId }],
    };
  }

  async list(
    tenantId: string,
    userId: string,
    page: number,
    limit: number,
  ): Promise<NotificationListResult> {
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      ...this.userScope(userId),
    };

    const { skip } = paginateParams(page, limit);
    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);

    return { items, unreadCount, total };
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        tenantId,
        readAt: null,
        ...this.userScope(userId),
      },
    });
  }

  async markRead(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<NotificationItem> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        tenantId,
        ...this.userScope(userId),
      },
    });

    if (!notification) {
      throw new NotFoundException('Thông báo không tồn tại');
    }

    if (notification.readAt) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(tenantId: string, userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId,
        readAt: null,
        ...this.userScope(userId),
      },
      data: { readAt: new Date() },
    });

    return { updated: result.count };
  }

  async remove(
    tenantId: string,
    userId: string,
    notificationId: string,
  ): Promise<{ deleted: number }> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        tenantId,
        ...this.userScope(userId),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Thông báo không tồn tại');
    }

    return { deleted: result.count };
  }

  async removeMany(tenantId: string, userId: string, ids: string[]): Promise<{ deleted: number }> {
    if (ids.length === 0) {
      return { deleted: 0 };
    }

    const result = await this.prisma.notification.deleteMany({
      where: {
        id: { in: ids },
        tenantId,
        ...this.userScope(userId),
      },
    });

    return { deleted: result.count };
  }

  async removeAll(tenantId: string, userId: string): Promise<{ deleted: number }> {
    const result = await this.prisma.notification.deleteMany({
      where: {
        tenantId,
        ...this.userScope(userId),
      },
    });

    return { deleted: result.count };
  }

  async createReviewNeeded(
    tenantId: string,
    _transactionDbId: string,
    content: string | null,
    confidenceScore: number,
  ): Promise<void> {
    const preview = this.buildContentPreview(content);
    const body = preview
      ? `Độ tin cậy ${confidenceScore}% — "${preview}"`
      : `Độ tin cậy ${confidenceScore}% — cần kế toán xác nhận định khoản`;

    await this.publish(tenantId, NotificationType.review_needed, {
      title: 'Giao dịch mới cần review',
      body,
      link: '/review',
    });
  }

  async createQuotaWarning(
    tenantId: string,
    used: number,
    quota: number,
    cycleStart: Date,
  ): Promise<void> {
    const percent = Math.round((used / quota) * 100);
    await this.createOncePerCycle(tenantId, NotificationType.quota_warning, cycleStart, {
      title: 'Sắp hết quota giao dịch',
      body: `Đã dùng ${used}/${quota} giao dịch (${percent}%) trong chu kỳ này. Cân nhắc nâng cấp gói.`,
      link: '/settings?tab=billing',
    });
  }

  async createQuotaExceeded(tenantId: string, quota: number, cycleStart: Date): Promise<void> {
    await this.createOncePerCycle(tenantId, NotificationType.quota_exceeded, cycleStart, {
      title: 'Đã hết quota giao dịch',
      body: `Đã dùng hết ${quota} giao dịch trong chu kỳ này.`,
      link: '/settings?tab=billing',
    });
  }

  async checkCopilotQuotaNotifications(
    tenantId: string,
    used: number,
    quota: number,
    cycleStart: Date,
  ): Promise<void> {
    if (quota === -1) return;

    if (used >= quota) {
      await this.createOncePerCycle(tenantId, NotificationType.copilot_quota_exceeded, cycleStart, {
        title: 'Đã hết lượt chat Copilot',
        body: `Đã dùng hết ${quota} lượt chat Copilot trong tháng này. Nâng cấp gói để tiếp tục.`,
        link: '/settings?tab=billing',
      });
      return;
    }

    const percent = used / quota;
    if (percent >= 0.8) {
      await this.createOncePerCycle(tenantId, NotificationType.copilot_quota_warning, cycleStart, {
        title: 'Sắp hết lượt chat Copilot',
        body: `Đã dùng ${used}/${quota} lượt chat Copilot (${Math.round(percent * 100)}%) trong tháng này.`,
        link: '/settings?tab=billing',
      });
    }
  }

  async createOverageStarted(
    tenantId: string,
    pricePerTransaction: number,
    cycleStart: Date,
  ): Promise<void> {
    await this.createOncePerCycle(tenantId, NotificationType.overage_started, cycleStart, {
      title: 'Giao dịch vượt quota',
      body: `Giao dịch mới vượt quota sẽ tính phí ${this.formatVnd(pricePerTransaction)}/giao dịch.`,
      link: '/settings?tab=billing',
    });
  }

  async createBillingSuccess(
    tenantId: string,
    kind: 'upgrade' | 'overage',
    plan: string,
    amount: number,
    quota?: number,
  ): Promise<void> {
    const planLabel = this.getPlanLabel(plan);

    if (kind === 'upgrade') {
      const quotaPart =
        quota != null ? ` Quota ${quota.toLocaleString('vi-VN')} giao dịch/tháng.` : '';
      await this.publish(tenantId, NotificationType.billing_success, {
        title: `Mua gói ${planLabel} thành công`,
        body: `Doanh nghiệp của bạn đã kích hoạt gói ${planLabel}.${quotaPart} Số tiền thanh toán: ${this.formatVnd(amount)}.`,
        link: '/settings?tab=billing',
      });
      return;
    }

    await this.publish(tenantId, NotificationType.billing_success, {
      title: 'Thanh toán phí vượt quota thành công',
      body: `Đã thanh toán ${this.formatVnd(amount)} cho phí vượt quota gói ${planLabel}.`,
      link: '/settings?tab=billing',
    });
  }

  async createPlanActivatedByPartner(tenantId: string, plan: string, quota: number): Promise<void> {
    const planLabel = this.getPlanLabel(plan);
    await this.publish(tenantId, NotificationType.billing_success, {
      title: `Gói ${planLabel} đã được kích hoạt`,
      body: `Gói dịch vụ của doanh nghiệp đã được cập nhật thành ${planLabel} (${quota.toLocaleString('vi-VN')} giao dịch/tháng).`,
      link: '/settings?tab=billing',
    });
  }

  async createBillingPaymentDue(
    tenantId: string,
    amount: number,
    overageCount: number,
  ): Promise<void> {
    await this.publish(tenantId, NotificationType.billing_payment_due, {
      title: 'Có phí vượt quota cần thanh toán',
      body: `${overageCount} giao dịch vượt quota — tổng ${this.formatVnd(amount)}. Vui lòng thanh toán để tiếp tục.`,
      link: '/settings?tab=billing',
    });
  }

  async createTenantSuspended(tenantId: string): Promise<void> {
    await this.publish(tenantId, NotificationType.tenant_suspended, {
      title: 'Tài khoản doanh nghiệp bị khóa',
      body: 'Tài khoản đã bị Cas Partner tạm khóa. Liên hệ hỗ trợ để được mở lại.',
      link: null,
    });
  }

  private async publish(
    tenantId: string,
    type: NotificationType,
    data: { title: string; body: string; link: string | null },
  ): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId: null,
        type,
        title: data.title,
        body: data.body,
        link: data.link,
      },
    });

    this.streamService.emitNotification(tenantId, notification);

    void Promise.all([
      this.deliveryService
        .enqueueEmailIfEnabled(tenantId, data)
        .catch((err: unknown) =>
          this.logger.warn(`Failed to queue email for tenant ${tenantId}`, err),
        ),
      this.deliveryService
        .sendSlackIfEnabled(tenantId, data)
        .catch((err: unknown) =>
          this.logger.warn(`Failed to send Slack for tenant ${tenantId}`, err),
        ),
    ]);
  }

  private async createOncePerCycle(
    tenantId: string,
    type: NotificationType,
    cycleStart: Date,
    data: { title: string; body: string; link: string | null },
  ): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        tenantId,
        type,
        userId: null,
        createdAt: { gte: cycleStart },
      },
    });

    if (existing) {
      return;
    }

    await this.publish(tenantId, type, data);
  }

  private formatVnd(amount: number): string {
    return `${amount.toLocaleString('vi-VN')}đ`;
  }

  private getPlanLabel(plan: string): string {
    const labels: Record<string, string> = {
      free: 'Free',
      starter: 'Starter',
      pro: 'Pro',
      enterprise: 'Enterprise',
    };
    return labels[plan.toLowerCase()] ?? plan;
  }

  private buildContentPreview(content: string | null): string {
    if (!content?.trim()) {
      return '';
    }

    const trimmed = content.trim();
    return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
  }
}
