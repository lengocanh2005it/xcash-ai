import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { Role } from '@xcash/shared-types';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { TeamInviteService } from '../team/team-invite.service';
import { AuthService } from './auth.service';
import { ChangePasswordService } from './change-password.service';
import { EmailVerificationService } from './email-verification.service';
import { PasswordResetService } from './password-reset.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redisClient = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    smembers: jest.fn().mockResolvedValue([]),
    expire: jest.fn(),
    pipeline: jest.fn(() => ({
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    })),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
  };

  const emailVerificationService = {
    sendOtp: jest.fn().mockResolvedValue(600),
    verifyOtp: jest.fn(),
  };

  const passwordResetService = {
    sendOtp: jest.fn().mockResolvedValue(600),
    verifyOtp: jest.fn(),
  };

  const changePasswordService = {
    initiate: jest.fn().mockResolvedValue(600),
    resend: jest.fn().mockResolvedValue(600),
    verifyAndConsume: jest.fn().mockResolvedValue('hashed-new-password'),
  };

  const teamInviteService = {
    getInvitePreview: jest.fn(),
    consumeToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultValue?: string) => {
              const values: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
                JWT_REFRESH_SESSION_EXPIRES_IN: '12h',
                NODE_ENV: 'test',
              };
              return values[key] ?? defaultValue;
            },
            getOrThrow: (key: string) => {
              const values: Record<string, string> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_REFRESH_SECRET: 'refresh-secret',
              };
              return values[key];
            },
          },
        },
        { provide: RedisService, useValue: { client: redisClient } },
        {
          provide: ChartOfAccountsService,
          useValue: { seedTt133: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: EmailVerificationService, useValue: emailVerificationService },
        { provide: PasswordResetService, useValue: passwordResetService },
        { provide: ChangePasswordService, useValue: changePasswordService },
        { provide: TeamInviteService, useValue: teamInviteService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('rejects login with invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('registers tenant and sends OTP without issuing tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockResolvedValue({
      createdUser: {
        id: 'user-1',
        email: 'admin@abc.edu.vn',
        name: 'Nguyễn Văn A',
        role: Role.ADMIN,
        tenantId: 'tenant-1',
      },
      tenantId: 'tenant-1',
    });

    const result = await service.register({
      businessName: 'ABC',
      ownerName: 'Nguyễn Văn A',
      email: 'admin@abc.edu.vn',
      password: 'password123',
      confirmPassword: 'password123',
    });

    expect(result.email).toBe('admin@abc.edu.vn');
    expect(emailVerificationService.sendOtp).toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects register when email already verified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing',
      emailVerifiedAt: new Date(),
    });

    await expect(
      service.register({
        businessName: 'ABC',
        ownerName: 'Nguyễn Văn A',
        email: 'admin@abc.edu.vn',
        password: 'password123',
        confirmPassword: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps unique-email race condition (P2002) to ConflictException', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.register({
        businessName: 'ABC',
        ownerName: 'Nguyễn Văn A',
        email: 'admin@abc.edu.vn',
        password: 'password123',
        confirmPassword: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('sends password reset OTP for verified user on forgot-password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'Nguyễn Văn A',
      emailVerifiedAt: new Date(),
      role: Role.ADMIN,
    });

    const result = await service.forgotPassword({ email: 'admin@abc.edu.vn' });

    expect(passwordResetService.sendOtp).toHaveBeenCalled();
    expect(result.message).toContain('mã OTP');
  });

  it('returns generic message on forgot-password when email not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'missing@example.com' });

    expect(passwordResetService.sendOtp).not.toHaveBeenCalled();
    expect(result.message).toContain('Nếu email tồn tại');
  });

  it('resets password after valid OTP and revokes refresh sessions', async () => {
    passwordResetService.verifyOtp.mockResolvedValue('user-1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
    });
    prisma.user.update.mockResolvedValue({});
    redisClient.smembers.mockResolvedValue(['jti-1']);

    const result = await service.resetPassword({
      email: 'admin@abc.edu.vn',
      otp: '123456',
      password: 'newpassword123',
      confirmPassword: 'newpassword123',
    });

    expect(prisma.user.update).toHaveBeenCalled();
    expect(redisClient.smembers).toHaveBeenCalledWith('user_sessions:user-1');
    expect(result.message).toContain('thành công');
  });

  it('requests change password after validating current password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'Nguyễn Văn A',
      passwordHash: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await service.requestChangePassword(
      {
        id: 'user-1',
        email: 'admin@abc.edu.vn',
        name: 'Nguyễn Văn A',
        role: Role.ADMIN,
        tenantId: 'tenant-1',
        businessName: 'ABC',
        plan: 'free',
        avatarUrl: null,
      },
      {
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123',
      },
    );

    expect(changePasswordService.initiate).toHaveBeenCalled();
    expect(result.otpExpiresInSeconds).toBe(600);
  });

  it('rejects change password when current password is wrong', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'Nguyễn Văn A',
      passwordHash: 'hashed-password',
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.requestChangePassword(
        {
          id: 'user-1',
          email: 'admin@abc.edu.vn',
          name: 'Nguyễn Văn A',
          role: Role.ADMIN,
          tenantId: 'tenant-1',
          businessName: 'ABC',
          plan: 'free',
          avatarUrl: null,
        },
        {
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123',
        },
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('confirms change password and revokes refresh sessions', async () => {
    prisma.user.update.mockResolvedValue({});
    redisClient.smembers.mockResolvedValue(['jti-1']);

    const result = await service.confirmChangePassword(
      {
        id: 'user-1',
        email: 'admin@abc.edu.vn',
        name: 'Nguyễn Văn A',
        role: Role.ADMIN,
        tenantId: 'tenant-1',
        businessName: 'ABC',
        plan: 'free',
        avatarUrl: null,
      },
      { otp: '123456' },
    );

    expect(changePasswordService.verifyAndConsume).toHaveBeenCalledWith('user-1', '123456');
    expect(prisma.user.update).toHaveBeenCalled();
    expect(redisClient.smembers).toHaveBeenCalledWith('user_sessions:user-1');
    expect(result.message).toContain('thành công');
  });

  it('issues tokens on successful login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'ABC',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      passwordHash: 'hashed-password',
      emailVerifiedAt: new Date(),
      tenant: { businessName: 'ABC' },
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.subscription.findFirst.mockResolvedValue({ status: 'active', plan: 'free' });

    const session = await service.login({
      email: 'admin@abc.edu.vn',
      password: 'password123',
    });

    expect(session.accessToken).toBe('signed-token');
    expect(session.user.role).toBe(Role.ADMIN);
    expect(session.rememberMe).toBe(true);
    expect(redisClient.set).toHaveBeenCalled();
  });

  it('issues session-scoped tokens when rememberMe is false', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'ABC',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      passwordHash: 'hashed-password',
      emailVerifiedAt: new Date(),
      tenant: { businessName: 'ABC' },
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.subscription.findFirst.mockResolvedValue({ status: 'active', plan: 'free' });

    const session = await service.login({
      email: 'admin@abc.edu.vn',
      password: 'password123',
      rememberMe: false,
    });

    expect(session.rememberMe).toBe(false);
    expect(redisClient.set).toHaveBeenCalledWith(
      expect.stringContaining('refresh_remember:'),
      '0',
      'EX',
      12 * 60 * 60,
    );
  });

  it('creates session cookie without Max-Age when rememberMe is false', () => {
    const cookie = service.createRefreshTokenCookie('token-abc', false);
    expect(cookie).toContain('refresh_token=token-abc');
    expect(cookie).not.toContain('Max-Age');
  });

  it('rejects login when email is not verified', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'ABC',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      passwordHash: 'hashed-password',
      emailVerifiedAt: null,
      invitedById: null,
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'admin@abc.edu.vn', password: 'password123' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects login when invited member has not activated account', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'keto@abc.edu.vn',
      name: 'Kế toán',
      role: Role.ACCOUNTANT,
      tenantId: 'tenant-1',
      passwordHash: 'hashed-password',
      emailVerifiedAt: null,
      invitedById: 'admin-1',
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(
      service.login({ email: 'keto@abc.edu.vn', password: 'password123' }),
    ).rejects.toMatchObject({
      response: { code: 'INVITE_PENDING' },
    });
  });

  it('activates invited member and issues tokens on accept-invite', async () => {
    teamInviteService.consumeToken.mockResolvedValue({
      userId: 'user-2',
      email: 'keto@abc.edu.vn',
      tenantId: 'tenant-1',
    });

    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'keto@abc.edu.vn',
      name: 'Kế toán',
      role: Role.ACCOUNTANT,
      tenantId: 'tenant-1',
      passwordHash: 'old-hash',
      emailVerifiedAt: null,
      tenant: { businessName: 'ABC' },
    });
    prisma.user.update.mockResolvedValue({});
    prisma.subscription.findFirst.mockResolvedValue({ status: 'active', plan: 'free' });

    const session = await service.acceptInvite({
      token: 'valid-token',
      password: 'newpassword123',
      confirmPassword: 'newpassword123',
    });

    expect(teamInviteService.consumeToken).toHaveBeenCalledWith('valid-token');
    expect(prisma.user.update).toHaveBeenCalled();
    expect(session.accessToken).toBe('signed-token');
  });

  it('rejects login when tenant subscription is suspended', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'ABC',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      passwordHash: 'hashed-password',
      emailVerifiedAt: new Date(),
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    prisma.subscription.findFirst.mockResolvedValue({ status: 'suspended' });

    await expect(
      service.login({ email: 'admin@abc.edu.vn', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects verify-email when tenant subscription is suspended', async () => {
    emailVerificationService.verifyOtp.mockResolvedValue('user-1');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'ABC',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      emailVerifiedAt: null,
      tenant: { businessName: 'ABC' },
    });
    prisma.user.update.mockResolvedValue({});
    prisma.subscription.findFirst.mockResolvedValue({ status: 'suspended' });

    await expect(
      service.verifyEmail({ email: 'admin@abc.edu.vn', otp: '123456' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns generic message on resend-password-reset when email not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.resendPasswordReset({ email: 'missing@example.com' });

    expect(passwordResetService.sendOtp).not.toHaveBeenCalled();
    expect(result.message).toContain('Nếu email tồn tại');
  });
});
