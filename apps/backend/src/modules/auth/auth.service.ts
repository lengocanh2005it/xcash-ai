import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@paypilot/shared-types';
import { Role as PrismaRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { AuthenticatedUser, AuthJwtPayload } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import type { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.refreshTtlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
  }

  async register(dto: RegisterDto): Promise<AuthSession> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const cycleEnd = this.getNextCycleEnd();

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          businessName: dto.businessName,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: dto.businessName,
          email: dto.email.toLowerCase(),
          passwordHash,
          role: PrismaRole.admin,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          plan: 'free',
          transactionQuota: 50,
          currentCycleEnd: cycleEnd,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          entityType: 'tenant',
          entityId: tenant.id,
          action: 'tenant_registered',
          actor: createdUser.id,
          afterState: {
            businessName: tenant.businessName,
            adminEmail: createdUser.email,
          },
        },
      });

      return createdUser;
    });

    return this.issueTokens(this.toAuthenticatedUser(user));
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.issueTokens(this.toAuthenticatedUser(user));
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
    const storedUserId = await this.redisService.client.get(redisKey);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã bị thu hồi');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    await this.redisService.client.del(redisKey);
    return this.issueTokens(this.toAuthenticatedUser(user));
  }

  async logout(refreshToken: string | undefined): Promise<{ message: string }> {
    if (!refreshToken) {
      return { message: 'Đăng xuất thành công' };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ jti: string }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      await this.redisService.client.del(this.refreshTokenKey(payload.jti));
    } catch {
      // Ignore invalid token on logout
    }

    return { message: 'Đăng xuất thành công' };
  }

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return this.toAuthenticatedUser(user);
  }

  createRefreshTokenCookie(refreshToken: string): string {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const parts = [
      `refresh_token=${refreshToken}`,
      'HttpOnly',
      'Path=/api/v1/auth',
      `Max-Age=${this.refreshTtlSeconds}`,
      'SameSite=Lax',
    ];
    if (isProduction) {
      parts.push('Secure');
    }
    return parts.join('; ');
  }

  getClearRefreshTokenCookie(): string {
    return 'refresh_token=; HttpOnly; Path=/api/v1/auth; Max-Age=0; SameSite=Lax';
  }

  toPublicSession(session: AuthSession) {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  private async issueTokens(user: AuthenticatedUser): Promise<AuthSession> {
    const payload: AuthJwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = await this.jwtService.signAsync(payload as object, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const jti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as `${number}${'s' | 'm' | 'h' | 'd'}`,
      },
    );

    await this.redisService.client.set(
      this.refreshTokenKey(jti),
      user.id,
      'EX',
      this.refreshTtlSeconds,
    );

    return { accessToken, refreshToken, user };
  }

  private refreshTokenKey(jti: string): string {
    return `refresh_token:${jti}`;
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    name: string;
    role: PrismaRole;
    tenantId: string | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      tenantId: user.tenantId,
    };
  }

  private getNextCycleEnd(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
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
