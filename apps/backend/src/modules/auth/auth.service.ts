import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, Role as PrismaRole, type SubscriptionPlan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { createAuditLog } from '../../common/util/audit-log.util';
import { PrismaService } from '../../prisma/prisma.service';
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
import { type AuthSession, TokenService } from './token.service';

export type { AuthSession } from './token.service';

export interface RegisterResult {
  email: string;
  message: string;
  otpExpiresInSeconds: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chartOfAccountsService: ChartOfAccountsService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly changePasswordService: ChangePasswordService,
    private readonly teamInviteService: TeamInviteService,
    private readonly tokenService: TokenService,
  ) {}

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

        await createAuditLog(tx, {
          tenantId: tenant.id,
          entityType: 'tenant',
          entityId: tenant.id,
          action: 'tenant_registered',
          actor: createdUser.id,
          afterState: {
            businessName: tenant.businessName,
            adminEmail: createdUser.email,
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

    await this.tokenService.assertNotSuspended(user.tenantId);

    const plan = await this.tokenService.getActivePlan(user.tenantId);
    return this.tokenService.issueTokens(
      this.tokenService.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan),
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
    return this.sendPasswordResetOtp(dto.email);
  }

  async resendPasswordReset(dto: ResendPasswordResetDto): Promise<{
    message: string;
    otpExpiresInSeconds?: number;
  }> {
    return this.sendPasswordResetOtp(dto.email);
  }

  private async sendPasswordResetOtp(email: string): Promise<{
    message: string;
    otpExpiresInSeconds?: number;
  }> {
    const normalizedEmail = email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    const genericMessage =
      'Nếu email tồn tại trong hệ thống, mã OTP đặt lại mật khẩu đã được gửi đến hộp thư của bạn.';

    if (!user) {
      return { message: genericMessage };
    }

    if (!user.emailVerifiedAt && user.role !== PrismaRole.cas_partner) {
      return { message: genericMessage };
    }

    const otpExpiresInSeconds = await this.passwordResetService.sendOtp(
      normalizedEmail,
      user.id,
      user.name,
    );

    return { message: genericMessage, otpExpiresInSeconds };
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

    await this.tokenService.revokeAllRefreshTokens(user.id);

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

    await this.tokenService.revokeAllRefreshTokens(user.id);

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

    await this.tokenService.assertNotSuspended(user.tenantId);

    const plan = await this.tokenService.getActivePlan(user.tenantId);
    const verifiedUser = { ...user, emailVerifiedAt: new Date() };

    return this.tokenService.issueTokens(
      this.tokenService.toAuthenticatedUser(verifiedUser, user.tenant?.businessName ?? null, plan),
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

    await this.tokenService.assertNotSuspended(user.tenantId);

    const plan = await this.tokenService.getActivePlan(user.tenantId);
    return this.tokenService.issueTokens(
      this.tokenService.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan),
      dto.rememberMe !== false,
    );
  }

  async refresh(refreshToken: string | undefined): Promise<AuthSession> {
    return this.tokenService.refresh(refreshToken);
  }

  async logout(refreshToken: string | undefined): Promise<{ message: string }> {
    return this.tokenService.logout(refreshToken);
  }

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: { select: { businessName: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    const plan = await this.tokenService.getActivePlan(user.tenantId);
    return this.tokenService.toAuthenticatedUser(user, user.tenant?.businessName ?? null, plan);
  }

  createRefreshTokenCookie(refreshToken: string, rememberMe = true): string {
    return this.tokenService.createRefreshTokenCookie(refreshToken, rememberMe);
  }

  getClearRefreshTokenCookie(): string {
    return this.tokenService.getClearRefreshTokenCookie();
  }

  toPublicSession(session: AuthSession) {
    return {
      accessToken: session.accessToken,
      user: session.user,
    };
  }

  async getActivePlanForUser(tenantId: string | null): Promise<SubscriptionPlan | null> {
    return this.tokenService.getActivePlan(tenantId);
  }

  private getNextCycleEnd(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
