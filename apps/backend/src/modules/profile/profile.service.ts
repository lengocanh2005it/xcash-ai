import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@xcash/shared-types';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PrismaService } from '../../prisma/prisma.service';
import { AzureBlobService } from '../../storage/azure-blob.service';
import { AuthService } from '../auth/auth.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  tenantId: string | null;
  businessName: string | null;
  ownerName: string | null;
  plan: AuthenticatedUser['plan'];
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly azureBlobService: AzureBlobService,
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: {
            businessName: true,
            ownerName: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const plan = await this.authService.getActivePlanForUser(user.tenantId);
    return this.toProfileResponse(user, plan);
  }

  async updateProfile(
    user: AuthenticatedUser,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponse> {
    const hasBusinessUpdate = dto.businessName !== undefined;

    if (hasBusinessUpdate) {
      if (user.role !== Role.ADMIN) {
        throw new ForbiddenException('Chỉ Admin mới được chỉnh sửa tên doanh nghiệp');
      }
      if (!user.tenantId) {
        throw new ForbiddenException('Tài khoản này không thuộc doanh nghiệp nào');
      }
    }

    if (dto.name !== undefined) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.name.trim() },
      });
    }

    if (hasBusinessUpdate && user.tenantId) {
      await this.prisma.tenant.update({
        where: { id: user.tenantId },
        data: { businessName: dto.businessName!.trim() },
      });
    }

    return this.getProfile(user.id);
  }

  async uploadAvatar(
    user: AuthenticatedUser,
    file: Express.Multer.File,
  ): Promise<UserProfileResponse> {
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    });

    if (!current) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const avatarUrl = await this.azureBlobService.uploadAvatar(user.id, file);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl },
    });

    if (current.avatarUrl && current.avatarUrl !== avatarUrl) {
      await this.azureBlobService.deleteByUrl(current.avatarUrl);
    }

    return this.getProfile(user.id);
  }

  private toProfileResponse(
    user: {
      id: string;
      email: string;
      name: string;
      avatarUrl: string | null;
      role: string;
      tenantId: string | null;
      tenant: { businessName: string; ownerName: string | null } | null;
    },
    plan: AuthenticatedUser['plan'],
  ): UserProfileResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role as Role,
      tenantId: user.tenantId,
      businessName: user.tenant?.businessName ?? null,
      ownerName: user.tenant?.ownerName ?? null,
      plan,
    };
  }
}
