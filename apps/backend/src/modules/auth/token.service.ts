import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type Role as PrismaRole, type SubscriptionPlan } from '@prisma/client';
import { Role } from '@xcash/shared-types';
import { SubscriptionQueryAdapter } from '../../common/services/subscription-query.adapter';
import type { AuthenticatedUser, AuthJwtPayload } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
  rememberMe: boolean;
}

@Injectable()
export class TokenService {
  private readonly refreshTtlSeconds: number;
  private readonly sessionRefreshTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly subscriptionQuery: SubscriptionQueryAdapter,
  ) {
    this.refreshTtlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
    this.sessionRefreshTtlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_SESSION_EXPIRES_IN', '12h'),
    );
  }

  async issueTokens(user: AuthenticatedUser, rememberMe = true): Promise<AuthSession> {
    const payload: AuthJwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      tenantId: user.tenantId,
      businessName: user.businessName,
      plan: user.plan,
    };

    const accessToken = await this.jwtService.signAsync(payload as object, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const jti = randomUUID();
    const refreshTtlSeconds = rememberMe ? this.refreshTtlSeconds : this.sessionRefreshTtlSeconds;
    const refreshExpiresIn = rememberMe
      ? this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d')
      : this.configService.get<string>('JWT_REFRESH_SESSION_EXPIRES_IN', '12h');

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    await this.redisService.set(this.refreshTokenKey(jti), user.id, 'EX', refreshTtlSeconds);
    await this.redisService.set(
      this.refreshRememberKey(jti),
      rememberMe ? '1' : '0',
      'EX',
      refreshTtlSeconds,
    );
    await this.redisService.sadd(this.userSessionsKey(user.id), jti);
    await this.redisService.expire(
      this.userSessionsKey(user.id),
      Math.max(this.refreshTtlSeconds, this.sessionRefreshTtlSeconds),
    );

    return { accessToken, refreshToken, user, rememberMe };
  }

  async refresh(refreshToken: string | undefined): Promise<AuthSession> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    let payload: { sub: string; jti: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string; jti: string }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }

    const redisKey = this.refreshTokenKey(payload.jti);
    const storedUserId = await this.redisService.get(redisKey);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã bị thu hồi');
    }

    const rememberRaw = await this.redisService.get(this.refreshRememberKey(payload.jti));
    const rememberMe = rememberRaw === '1';

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: { select: { businessName: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    await this.redisService.del(redisKey);
    await this.redisService.del(this.refreshRememberKey(payload.jti));
    await this.redisService.srem(this.userSessionsKey(payload.sub), payload.jti);
    const plan = await this.getActivePlan(user.tenantId);
    return this.issueTokens(
      this.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan),
      rememberMe,
    );
  }

  async logout(refreshToken: string | undefined): Promise<{ message: string }> {
    if (!refreshToken) {
      return { message: 'Đăng xuất thành công' };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; jti: string }>(
        refreshToken,
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        },
      );
      await this.redisService.del(this.refreshTokenKey(payload.jti));
      await this.redisService.del(this.refreshRememberKey(payload.jti));
      await this.redisService.srem(this.userSessionsKey(payload.sub), payload.jti);
    } catch {
      // Ignore invalid token on logout
    }

    return { message: 'Đăng xuất thành công' };
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const jtis = await this.redisService.smembers(this.userSessionsKey(userId));
    if (jtis.length === 0) {
      return;
    }

    const pipeline = this.redisService.pipeline();
    for (const jti of jtis) {
      pipeline.del(this.refreshTokenKey(jti));
      pipeline.del(this.refreshRememberKey(jti));
    }
    pipeline.del(this.userSessionsKey(userId));
    await pipeline.exec();
  }

  async getActivePlan(tenantId: string | null): Promise<SubscriptionPlan | null> {
    if (!tenantId) return null;
    const planInfo = await this.subscriptionQuery.findActivePlan(tenantId);
    return planInfo?.plan ?? null;
  }

  async assertNotSuspended(tenantId: string | null): Promise<void> {
    if (!tenantId) return;
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
    });
    if (subscription?.status === 'suspended') {
      throw new UnauthorizedException(
        'Tài khoản doanh nghiệp đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
      );
    }
  }

  toAuthenticatedUser(
    user: {
      id: string;
      email: string;
      name: string;
      avatarUrl?: string | null;
      role: PrismaRole;
      tenantId: string | null;
    },
    businessName: string | null,
    plan: SubscriptionPlan | null,
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role as Role,
      tenantId: user.tenantId,
      businessName,
      plan,
    };
  }

  createRefreshTokenCookie(refreshToken: string, rememberMe = true): string {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const parts = [
      `refresh_token=${refreshToken}`,
      'HttpOnly',
      'Path=/api/v1/auth',
      'SameSite=Lax',
    ];
    if (rememberMe) {
      parts.push(`Max-Age=${this.refreshTtlSeconds}`);
    }
    if (isProduction) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  getClearRefreshTokenCookie(): string {
    return 'refresh_token=; HttpOnly; Path=/api/v1/auth; Max-Age=0; SameSite=Lax';
  }

  private refreshTokenKey(jti: string): string {
    return `refresh_token:${jti}`;
  }

  private refreshRememberKey(jti: string): string {
    return `refresh_remember:${jti}`;
  }

  private userSessionsKey(userId: string): string {
    return `user_sessions:${userId}`;
  }

  private parseDurationToSeconds(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) {
      return 7 * 24 * 60 * 60;
    }
    const value = Number.parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 7 * 24 * 60 * 60;
    }
  }
}
