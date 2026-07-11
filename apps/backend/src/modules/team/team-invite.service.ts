import { randomBytes } from 'node:crypto';
import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import {
  EMAIL_INVITE_JOB,
  EMAIL_JOB_OPTIONS,
  type EmailInviteJobData,
} from '../notification/email.constants';

export interface StoredInvitePayload {
  userId: string;
  email: string;
  tenantId: string;
}

export interface InvitePreview {
  email: string;
  name: string;
  businessName: string;
  role: string;
  inviterName: string;
  expiresInSeconds: number;
}

@Injectable()
export class TeamInviteService {
  private readonly logger = new Logger(TeamInviteService.name);
  private readonly inviteTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailInviteJobData>,
  ) {
    this.inviteTtlSeconds = Number.parseInt(
      this.configService.get<string>('TEAM_INVITE_TTL_SECONDS', '604800'),
      10,
    );
  }

  async sendInvite(userId: string, inviterId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: { select: { businessName: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (!user?.tenantId || !user.tenant) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Thành viên đã kích hoạt tài khoản');
    }

    const inviter =
      user.invitedBy ?? (await this.prisma.user.findUnique({ where: { id: inviterId } }));
    const inviterName = inviter?.name ?? 'Admin';

    const token = await this.createToken({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const activationUrl = `${frontendUrl}/accept-invite?token=${encodeURIComponent(token)}`;

    const roleLabel = user.role === 'accountant' ? 'Kế toán' : 'Chỉ xem';

    await this.emailQueue.add(
      EMAIL_INVITE_JOB,
      {
        to: user.email,
        inviteeName: user.name,
        inviterName,
        businessName: user.tenant.businessName,
        roleLabel,
        activationUrl,
      },
      EMAIL_JOB_OPTIONS,
    );

    this.logger.log(`Queued team invite email for ${user.email}`);
  }

  async getInvitePreview(token: string): Promise<InvitePreview> {
    const payload = await this.getPayloadByToken(token);
    if (!payload) {
      throw new BadRequestException('Link mời không hợp lệ hoặc đã hết hạn');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenant: { select: { businessName: true } },
        invitedBy: { select: { name: true } },
      },
    });

    if (
      !user ||
      user.email.toLowerCase() !== payload.email.toLowerCase() ||
      user.tenantId !== payload.tenantId
    ) {
      throw new BadRequestException('Link mời không hợp lệ hoặc đã hết hạn');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Tài khoản đã được kích hoạt. Vui lòng đăng nhập.');
    }

    const ttl = await this.redisService.ttl(this.tokenKey(token));

    return {
      email: user.email,
      name: user.name,
      businessName: user.tenant?.businessName ?? '',
      role: user.role,
      inviterName: user.invitedBy?.name ?? 'Admin',
      expiresInSeconds: Math.max(ttl, 0),
    };
  }

  async consumeToken(token: string): Promise<StoredInvitePayload> {
    const payload = await this.getPayloadByToken(token);
    if (!payload) {
      throw new BadRequestException('Link mời không hợp lệ hoặc đã hết hạn');
    }

    await this.redisService.del(this.tokenKey(token));
    await this.redisService.del(this.userTokenKey(payload.userId));

    return payload;
  }

  private async createToken(payload: StoredInvitePayload): Promise<string> {
    const existingToken = await this.redisService.get(this.userTokenKey(payload.userId));
    if (existingToken) {
      await this.redisService.del(this.tokenKey(existingToken));
    }

    const token = randomBytes(32).toString('base64url');
    await this.redisService.set(
      this.tokenKey(token),
      JSON.stringify(payload),
      'EX',
      this.inviteTtlSeconds,
    );
    await this.redisService.set(
      this.userTokenKey(payload.userId),
      token,
      'EX',
      this.inviteTtlSeconds,
    );

    return token;
  }

  private async getPayloadByToken(token: string): Promise<StoredInvitePayload | null> {
    const raw = await this.redisService.get(this.tokenKey(token));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredInvitePayload;
  }

  private tokenKey(token: string): string {
    return `team_invite:token:${token}`;
  }

  private userTokenKey(userId: string): string {
    return `team_invite:user:${userId}`;
  }
}
