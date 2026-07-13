import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OtpFlowService } from '../../common/services/otp-flow.service';
import { EMAIL_QUEUE } from '../../queue/queue.module';
import { EMAIL_CHANGE_PASSWORD_OTP_JOB } from '../notification/email.constants';
import { ChangePasswordService } from './change-password.service';

describe('ChangePasswordService', () => {
  let service: ChangePasswordService;

  const otpFlowService = {
    send: jest.fn().mockResolvedValue({ otp: '123456', ttlSeconds: 600 }),
    peek: jest.fn(),
    verify: jest.fn(),
  };

  const emailQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    otpFlowService.send.mockResolvedValue({ otp: '123456', ttlSeconds: 600 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangePasswordService,
        { provide: OtpFlowService, useValue: otpFlowService },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: emailQueue },
      ],
    }).compile();

    service = module.get(ChangePasswordService);
  });

  it('initiate stores OTP payload via OtpFlowService and queues email', async () => {
    const ttl = await service.initiate(
      'user-1',
      'Admin@ABC.edu.vn',
      'Nguyen Van A',
      'hashed-new-password',
    );

    expect(ttl).toBe(600);
    expect(otpFlowService.send).toHaveBeenCalledWith(
      'change_password',
      'user-1',
      expect.objectContaining({
        userId: 'user-1',
        email: 'admin@abc.edu.vn',
        newPasswordHash: 'hashed-new-password',
      }),
    );
    expect(emailQueue.add).toHaveBeenCalledWith(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      expect.objectContaining({
        to: 'admin@abc.edu.vn',
        userName: 'Nguyen Van A',
        otp: '123456',
      }),
      expect.any(Object),
    );
  });

  it('resend throws when no pending request exists', async () => {
    otpFlowService.peek.mockResolvedValueOnce(undefined);

    await expect(service.resend('user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(otpFlowService.send).not.toHaveBeenCalled();
  });

  it('resend re-sends using the previously stored payload', async () => {
    otpFlowService.peek.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'admin@abc.edu.vn',
      userName: 'Nguyen Van A',
      newPasswordHash: 'hashed-new-password',
    });

    const ttl = await service.resend('user-1');

    expect(ttl).toBe(600);
    expect(otpFlowService.send).toHaveBeenCalledWith(
      'change_password',
      'user-1',
      expect.objectContaining({ newPasswordHash: 'hashed-new-password' }),
    );
    expect(emailQueue.add).toHaveBeenCalledWith(
      EMAIL_CHANGE_PASSWORD_OTP_JOB,
      expect.objectContaining({ to: 'admin@abc.edu.vn', userName: 'Nguyen Van A' }),
      expect.any(Object),
    );
  });

  it('verifyAndConsume returns password hash on valid OTP', async () => {
    otpFlowService.verify.mockResolvedValueOnce({
      userId: 'user-1',
      email: 'admin@abc.edu.vn',
      userName: 'Nguyen Van A',
      newPasswordHash: 'hashed-new-password',
    });

    const hash = await service.verifyAndConsume('user-1', '123456');

    expect(hash).toBe('hashed-new-password');
    expect(otpFlowService.verify).toHaveBeenCalledWith('change_password', 'user-1', '123456');
  });

  it('verifyAndConsume rejects when payload belongs to a different user', async () => {
    otpFlowService.verify.mockResolvedValueOnce({
      userId: 'someone-else',
      email: 'admin@abc.edu.vn',
      userName: 'Nguyen Van A',
      newPasswordHash: 'hashed-new-password',
    });

    await expect(service.verifyAndConsume('user-1', '123456')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propagates cooldown errors from OtpFlowService.send', async () => {
    otpFlowService.send.mockRejectedValueOnce(
      new HttpException(
        'Vui lòng đợi 45 giây trước khi gửi lại mã OTP',
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    );

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
