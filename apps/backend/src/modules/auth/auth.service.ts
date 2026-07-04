import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role as PrismaRole, type SubscriptionPlan } from '@prisma/client';
import { Role } from '@xcash/shared-types';
import * as bcrypt from 'bcryptjs';
import type { AuthenticatedUser, AuthJwtPayload } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { TeamInviteService } from '../team/team-invite.service';
import { ChangePasswordService } from './change-password.service';
import type {
  AcceptInviteDto,
  ChangePasswordConfirmDto,
  ChangePasswordRequestDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendPasswordResetDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
  rememberMe: boolean;
}

export interface RegisterResult {
  email: string;
  message: string;
  otpExpiresInSeconds: number;
}

@Injectable()
export class AuthService {
  private readonly refreshTtlSeconds: number;
  private readonly sessionRefreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly teamInviteService: TeamInviteService,
  ) {
    this.refreshTtlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    );
    this.sessionRefreshTtlSeconds = this.parseDurationToSeconds(
      this.configService.get<string>('JWT_REFRESH_SESSION_EXPIRES_IN', '12h'),
    );
  }

  async register(dto: RegisterDto): Promise<RegisterResult> {
    const email = dto.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (!existingUser.emailVerifiedAt) {
        const otpExpiresInSeconds = await this.emailVerificationService.sendOtp(
          email,
          existingUser.id,
          existingUser.name,
        );
        return {
          email,
          message: 'Email đã đăng ký nhưng chưa xác thực. Mã OTP mới đã được gửi.',
          otpExpiresInSeconds,
        };
      }
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const cycleEnd = this.getNextCycleEnd();

    let user: { createdUser: { id: string }; tenantId: string };
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            businessName: dto.businessName,
            ownerName: dto.ownerName,
          },
        });

        const createdUser = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: dto.ownerName,
            email,
            passwordHash,
            role: PrismaRole.admin,
            emailVerifiedAt: null,
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

        return { createdUser, tenantId: tenant.id };
      });
    } catch (error) {
      // Unique constraint on email — race condition between the pre-check above
      // and the insert. Surface as a friendly 409 instead of a 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }

    this.chartOfAccountsService.seedTt133(user.tenantId).catch(() => {});

    const otpExpiresInSeconds = await this.emailVerificationService.sendOtp(
      email,
      user.createdUser.id,
      dto.ownerName,
    );

    return {
      email,
      message: 'Đăng ký thành công. Vui lòng kiểm tra email và nhập mã OTP để kích hoạt tài khoản.',
      otpExpiresInSeconds,
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthSession> {
    const email = dto.email.toLowerCase();
    const userId = await this.emailVerificationService.verifyOtp(email, dto.otp);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { businessName: true } } },
    });

    if (!user || user.email.toLowerCase() !== email) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (!user.emailVerifiedAt) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }

    if (user.tenantId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { startedAt: 'desc' },
      });
      if (subscription?.status === 'suspended') {
        throw new UnauthorizedException(
          'Tài khoản doanh nghiệp đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
        );
      }
    }

    const plan = await this.getActivePlan(user.tenantId);
    return this.issueTokens(
      this.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan),
      true,
    );
  }

  async resendVerification(dto: ResendVerificationDto): Promise<{
    message: string;
    otpExpiresInSeconds?: number;
  }> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const genericMessage =
      'Nếu email tồn tại và chưa được xác thực, mã OTP mới đã được gửi đến hộp thư của bạn.';

    if (!user || user.emailVerifiedAt) {
      return { message: genericMessage };
    }

    const otpExpiresInSeconds = await this.emailVerificationService.sendOtp(
      email,
      user.id,
      user.name,
    );

    return {
      message: genericMessage,
      otpExpiresInSeconds,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{
    message: string;
    otpExpiresInSeconds?: number;
  }> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const genericMessage =
      'Nếu email tồn tại trong hệ thống, mã OTP đặt lại mật khẩu đã được gửi đến hộp thư của bạn.';

    if (!user) {
      return { message: genericMessage };
    }

    if (!user.emailVerifiedAt && user.role !== PrismaRole.cas_partner) {
      return { message: genericMessage };
    }

    const otpExpiresInSeconds = await this.passwordResetService.sendOtp(email, user.id, user.name);

    return { message: genericMessage, otpExpiresInSeconds };
  }

  async resendPasswordReset(dto: ResendPasswordResetDto): Promise<{
    message: string;
    otpExpiresInSeconds?: number;
  }> {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    const genericMessage =
      'Nếu email tồn tại trong hệ thống, mã OTP đặt lại mật khẩu đã được gửi đến hộp thư của bạn.';

    if (!user) {
      return { message: genericMessage };
    }

    if (!user.emailVerifiedAt && user.role !== PrismaRole.cas_partner) {
      return { message: genericMessage };
    }

    const otpExpiresInSeconds = await this.passwordResetService.sendOtp(email, user.id, user.name);

    return {
      message: genericMessage,
      otpExpiresInSeconds,
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const userId = await this.passwordResetService.verifyOtp(email, dto.otp);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email.toLowerCase() !== email) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.revokeAllRefreshTokens(user.id);

    return { message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.' };
  }

  async requestChangePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordRequestDto,
  ): Promise<{ message: string; otpExpiresInSeconds: number }> {
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, dbUser.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, dbUser.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    const otpExpiresInSeconds = await this.changePasswordService.initiate(
      dbUser.id,
      dbUser.email,
      dbUser.name,
      newPasswordHash,
    );

    return {
      message: 'Mã OTP đã được gửi đến email của bạn. Vui lòng nhập mã để hoàn tất đổi mật khẩu.',
      otpExpiresInSeconds,
    };
  }

  async resendChangePasswordOtp(
    user: AuthenticatedUser,
  ): Promise<{ message: string; otpExpiresInSeconds: number }> {
    const otpExpiresInSeconds = await this.changePasswordService.resend(user.id);

    return {
      message: 'Đã gửi lại mã OTP đến email của bạn.',
      otpExpiresInSeconds,
    };
  }

  async confirmChangePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordConfirmDto,
  ): Promise<{ message: string }> {
    const newPasswordHash = await this.changePasswordService.verifyAndConsume(user.id, dto.otp);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    await this.revokeAllRefreshTokens(user.id);

    return {
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại với mật khẩu mới.',
    };
  }

  getInviteInfo(token: string) {
    if (!token?.trim()) {
      throw new BadRequestException('Link mời không hợp lệ');
    }
    return this.teamInviteService.getInvitePreview(token.trim());
  }

  async acceptInvite(dto: AcceptInviteDto): Promise<AuthSession> {
    const payload = await this.teamInviteService.consumeToken(dto.token.trim());

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: { select: { businessName: true } } },
    });

    if (
      !user ||
      user.email.toLowerCase() !== payload.email.toLowerCase() ||
      user.tenantId !== payload.tenantId
    ) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Tài khoản đã được kích hoạt. Vui lòng đăng nhập.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    if (user.tenantId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { startedAt: 'desc' },
      });
      if (subscription?.status === 'suspended') {
        throw new UnauthorizedException(
          'Tài khoản doanh nghiệp đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
        );
      }
    }

    const plan = await this.getActivePlan(user.tenantId);
    const verifiedUser = { ...user, emailVerifiedAt: new Date() };

    return this.issueTokens(
      this.toAuthenticatedUser(verifiedUser, user.tenant?.businessName ?? null, plan),
      true,
    );
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { tenant: { select: { businessName: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.emailVerifiedAt && user.role !== PrismaRole.cas_partner) {
      if (user.invitedById) {
        throw new ForbiddenException({
          code: 'INVITE_PENDING',
          message:
            'Tài khoản chưa được kích hoạt. Vui lòng mở link trong email mời hoặc liên hệ Admin gửi lại.',
        });
      }

      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email chưa được xác thực. Vui lòng nhập mã OTP đã gửi đến hộp thư.',
      });
    }

    let plan: SubscriptionPlan | null = null;
    if (user.tenantId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { tenantId: user.tenantId },
        orderBy: { startedAt: 'desc' },
      });
      if (subscription?.status === 'suspended') {
        throw new UnauthorizedException(
          'Tài khoản doanh nghiệp đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.',
        );
      }
      plan = subscription?.status === 'active' ? subscription.plan : null;
    }

    return this.issueTokens(
      this.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan),
      dto.rememberMe !== false,
    );
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

    const rememberRaw = await this.redisService.client.get(this.refreshRememberKey(payload.jti));
    const rememberMe = rememberRaw === '1';

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: { select: { businessName: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    await this.redisService.client.del(redisKey);
    await this.redisService.client.del(this.refreshRememberKey(payload.jti));
    await this.redisService.client.srem(this.userSessionsKey(payload.sub), payload.jti);
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
      await this.redisService.client.del(this.refreshTokenKey(payload.jti));
      await this.redisService.client.del(this.refreshRememberKey(payload.jti));
      await this.redisService.client.srem(this.userSessionsKey(payload.sub), payload.jti);
    } catch {
      // Ignore invalid token on logout
    }

    return { message: 'Đăng xuất thành công' };
  }

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { businessName: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    const plan = await this.getActivePlan(user.tenantId);
    return this.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan);
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

  toPublicSession(session: AuthSession) {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  private async issueTokens(user: AuthenticatedUser, rememberMe = true): Promise<AuthSession> {
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

    await this.redisService.client.set(this.refreshTokenKey(jti), user.id, 'EX', refreshTtlSeconds);
    await this.redisService.client.set(
      this.refreshRememberKey(jti),
      rememberMe ? '1' : '0',
      'EX',
      refreshTtlSeconds,
    );
    await this.redisService.client.sadd(this.userSessionsKey(user.id), jti);
    await this.redisService.client.expire(
      this.userSessionsKey(user.id),
      Math.max(this.refreshTtlSeconds, this.sessionRefreshTtlSeconds),
    );

    return { accessToken, refreshToken, user, rememberMe };
  }

  private async revokeAllRefreshTokens(userId: string): Promise<void> {
    const jtis = await this.redisService.client.smembers(this.userSessionsKey(userId));
    if (jtis.length === 0) {
      return;
    }

    const pipeline = this.redisService.client.pipeline();
    for (const jti of jtis) {
      pipeline.del(this.refreshTokenKey(jti));
      pipeline.del(this.refreshRememberKey(jti));
    }
    pipeline.del(this.userSessionsKey(userId));
    await pipeline.exec();
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

  private toAuthenticatedUser(
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

  async getActivePlanForUser(tenantId: string | null): Promise<SubscriptionPlan | null> {
    return this.getActivePlan(tenantId);
  }

  private async getActivePlan(tenantId: string | null): Promise<SubscriptionPlan | null> {
    if (!tenantId) return null;
    const subscription = await this.prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { startedAt: 'desc' },
      select: { plan: true },
    });
    return subscription?.plan ?? null;
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
