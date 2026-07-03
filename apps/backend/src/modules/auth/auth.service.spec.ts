import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@xcash/shared-types';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ChartOfAccountsService } from '../chart-of-accounts/chart-of-accounts.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redisClient = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('signed-token'),
    verifyAsync: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('rejects login with invalid credentials', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects register when email already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.register({
        businessName: 'ABC',
        email: 'admin@abc.edu.vn',
        password: 'password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('issues tokens on successful login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@abc.edu.vn',
      name: 'ABC',
      role: Role.ADMIN,
      tenantId: 'tenant-1',
      passwordHash: 'hashed-password',
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const session = await service.login({
      email: 'admin@abc.edu.vn',
      password: 'password123',
    });

    expect(session.accessToken).toBe('signed-token');
    expect(session.user.role).toBe(Role.ADMIN);
    expect(redisClient.set).toHaveBeenCalled();
  });
});
