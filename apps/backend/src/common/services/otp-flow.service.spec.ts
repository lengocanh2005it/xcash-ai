import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../redis/redis.service';
import { OtpFlowService } from './otp-flow.service';

describe('OtpFlowService', () => {
  let service: OtpFlowService;

  const redisClient = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
    del: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(45),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisClient.set.mockResolvedValue('OK');
    redisClient.del.mockResolvedValue(1);
    redisClient.ttl.mockResolvedValue(45);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpFlowService,
        { provide: RedisService, useValue: redisClient },
        { provide: ConfigService, useValue: { get: (_key: string, def?: string) => def } },
      ],
    }).compile();

    service = module.get(OtpFlowService);
  });

  describe('send', () => {
    it('stores the OTP + payload under the prefixed key with the configured TTL', async () => {
      redisClient.get.mockResolvedValueOnce(null);

      const { otp, ttlSeconds } = await service.send('email_verify', 'user@x.com', {
        userId: 'user-1',
      });

      expect(otp).toMatch(/^\d{6}$/);
      expect(ttlSeconds).toBe(600);
      expect(redisClient.set).toHaveBeenCalledWith(
        'email_verify_otp:user@x.com',
        expect.stringContaining(otp),
        'EX',
        600,
      );
      expect(redisClient.set).toHaveBeenCalledWith('email_verify_resend:user@x.com', '1', 'EX', 60);
    });

    it('throws a 429 when a resend cooldown is still active', async () => {
      redisClient.get.mockResolvedValueOnce('1');

      await expect(service.send('email_verify', 'user@x.com', { userId: 'u1' })).rejects.toEqual(
        new HttpException(
          'Vui lòng đợi 45 giây trước khi gửi lại mã OTP',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
      expect(redisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('peek', () => {
    it('returns undefined when nothing is stored', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      expect(await service.peek('change_password', 'user-1')).toBeUndefined();
    });

    it('returns the stored payload without consuming it', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify({ otp: '123456', attempts: 0, payload: { userId: 'user-1' } }),
      );

      const payload = await service.peek('change_password', 'user-1');

      expect(payload).toEqual({ userId: 'user-1' });
      expect(redisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('throws when no OTP is stored', async () => {
      redisClient.get.mockResolvedValueOnce(null);
      await expect(service.verify('email_verify', 'user@x.com', '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns the payload and deletes the key on correct OTP', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify({ otp: '123456', attempts: 0, payload: { userId: 'user-1' } }),
      );

      const payload = await service.verify('email_verify', 'user@x.com', '123456');

      expect(payload).toEqual({ userId: 'user-1' });
      expect(redisClient.del).toHaveBeenCalledWith('email_verify_otp:user@x.com');
    });

    it('increments attempts and preserves remaining TTL on wrong OTP', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify({ otp: '123456', attempts: 0, payload: { userId: 'user-1' } }),
      );
      redisClient.ttl.mockResolvedValueOnce(300);

      await expect(service.verify('email_verify', 'user@x.com', '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(redisClient.set).toHaveBeenCalledWith(
        'email_verify_otp:user@x.com',
        expect.stringContaining('"attempts":1'),
        'EX',
        300,
      );
    });

    it('does not resave when the key has already expired mid-check', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify({ otp: '123456', attempts: 0, payload: { userId: 'user-1' } }),
      );
      redisClient.ttl.mockResolvedValueOnce(-2);

      await expect(service.verify('email_verify', 'user@x.com', '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(redisClient.set).not.toHaveBeenCalled();
    });

    it('deletes the key once max attempts is reached', async () => {
      redisClient.get.mockResolvedValueOnce(
        JSON.stringify({ otp: '123456', attempts: 5, payload: { userId: 'user-1' } }),
      );

      await expect(service.verify('email_verify', 'user@x.com', '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(redisClient.del).toHaveBeenCalledWith('email_verify_otp:user@x.com');
    });
  });
});
