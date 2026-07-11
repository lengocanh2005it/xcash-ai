import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import { RedisService } from '../../redis/redis.service';
import { EMAIL_CHANGE_PASSWORD_OTP_JOB } from '../notification/email.constants';
import { ChangePasswordService } from './change-password.service';

describe('ChangePasswordService', () => {
  let service: ChangePasswordService;

  const redisClient = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(45),
  };

  const emailQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangePasswordService,
        {
          provide: RedisService,
          useValue: redisClient,
        },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, defaultValue?: string) => defaultValue,
          },
        },
        {
          provide: getQueueToken(EMAIL_QUEUE),
          useValue: emailQueue,
        },
      ],
    }).compile();

    service = module.get(ChangePasswordService);
  });

  it('initiate stores OTP payload and queues email', async () => {
    redisClient.get.mockResolvedValueOnce(null);

    const ttl = await service.initiate(
      'user-1',
      'Admin@ABC.edu.vn',
      'Nguyen Van A',
      'hashed-new-password',
    );

    expect(ttl).toBe(600);
    expect(redisClient.set).toHaveBeenCalledWith(
      'change_password_otp:user-1',
      expect.stringContaining('hashed-new-password'),
      'EX',
      600,
    );
    expect(emailQueue.add).toHaveBeenCalledWith(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      expect.objectContaining({
        to: 'admin@abc.edu.vn',
        userName: 'Nguyen Van A',
      }),
      expect.any(Object),
    );
  });

  it('resend throws when no pending request exists', async () => {
    redisClient.get.mockResolvedValueOnce(null);

    await expect(service.resend('user-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('verifyAndConsume returns password hash on valid OTP', async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        otp: '123456',
        userId: 'user-1',
        email: 'admin@abc.edu.vn',
        userName: 'Nguyen Van A',
        newPasswordHash: 'hashed-new-password',
        attempts: 0,
      }),
    );

    const hash = await service.verifyAndConsume('user-1', '123456');

    expect(hash).toBe('hashed-new-password');
    expect(redisClient.del).toHaveBeenCalledWith('change_password_otp:user-1');
  });

  it('verifyAndConsume rejects invalid OTP', async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        otp: '123456',
        userId: 'user-1',
        email: 'admin@abc.edu.vn',
        userName: 'Nguyen Van A',
        newPasswordHash: 'hashed-new-password',
        attempts: 0,
      }),
    );
    redisClient.ttl.mockResolvedValueOnce(300);

    await expect(service.verifyAndConsume('user-1', '000000')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('initiate enforces resend cooldown', async () => {
    redisClient.get.mockResolvedValueOnce('1');

    await expect(
      service.initiate('user-1', 'admin@abc.edu.vn', 'Nguyen Van A', 'hash'),
    ).rejects.toEqual(
      new HttpException(
        'Vui lòng đợi 45 giây trước khi gửi lại mã OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );
  });
});
