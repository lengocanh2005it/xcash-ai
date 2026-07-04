import { ForbiddenException } from '@nestjs/common';
import { Role } from '@xcash/shared-types';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      update: jest.fn(),
    },
  };
  const authService = {
    getActivePlanForUser: jest.fn(),
  };
  const azureBlobService = {
    uploadAvatar: jest.fn(),
    deleteByUrl: jest.fn(),
  };

  const service = new ProfileService(
    prisma as never,
    authService as never,
    azureBlobService as never,
  );

  const baseUser = {
    id: 'user-1',
    email: 'a@example.com',
    name: 'User A',
    avatarUrl: null,
    role: Role.ADMIN,
    tenantId: 'tenant-1',
    tenant: {
      businessName: 'Biz A',
      ownerName: 'Owner A',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    authService.getActivePlanForUser.mockResolvedValue(null);
  });

  it('returns profile with tenant info', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);

    const result = await service.getProfile('user-1');

    expect(result).toMatchObject({
      id: 'user-1',
      email: 'a@example.com',
      businessName: 'Biz A',
      ownerName: 'Owner A',
    });
  });

  it('blocks non-admin from updating business info', async () => {
    await expect(
      service.updateProfile(
        {
          id: 'user-2',
          email: 'b@example.com',
          name: 'Viewer',
          avatarUrl: null,
          role: Role.VIEWER,
          tenantId: 'tenant-1',
          businessName: 'Biz A',
          plan: null,
        },
        { businessName: 'New Biz' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uploads avatar and deletes previous blob', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ avatarUrl: 'https://old.example/avatar.jpg' })
      .mockResolvedValueOnce(baseUser);
    azureBlobService.uploadAvatar.mockResolvedValue('https://new.example/avatar.jpg');
    prisma.user.update.mockResolvedValue({});

    const result = await service.uploadAvatar(
      {
        id: 'user-1',
        email: 'a@example.com',
        name: 'User A',
        avatarUrl: null,
        role: Role.ADMIN,
        tenantId: 'tenant-1',
        businessName: 'Biz A',
        plan: null,
      },
      { buffer: Buffer.from('x'), mimetype: 'image/png', size: 1 } as Express.Multer.File,
    );

    expect(azureBlobService.uploadAvatar).toHaveBeenCalled();
    expect(azureBlobService.deleteByUrl).toHaveBeenCalledWith('https://old.example/avatar.jpg');
    expect(result.name).toBe('User A');
  });
});
