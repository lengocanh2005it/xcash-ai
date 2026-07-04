import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { InviteMemberDto } from './dto/team.dto';
import { TeamInviteService } from './team-invite.service';

export interface InviteMemberResult {
  email: string;
  message: string;
}

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamInviteService: TeamInviteService,
  ) {}

  async getMembers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        invitedAt: true,
        emailVerifiedAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(
    tenantId: string,
    inviterId: string,
    dto: InviteMemberDto,
  ): Promise<InviteMemberResult> {
    const normalizedEmail = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (existing.tenantId !== tenantId) {
        throw new ConflictException('Email đã được sử dụng');
      }
      if (existing.emailVerifiedAt) {
        throw new ConflictException('Email đã được sử dụng');
      }

      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          role: dto.role as unknown as import('@prisma/client').Role,
          invitedById: inviterId,
          invitedAt: new Date(),
        },
      });

      await this.teamInviteService.sendInvite(existing.id, inviterId);

      return {
        email: normalizedEmail,
        message: 'Đã gửi lại email mời. Thành viên cần mở link trong email để đặt mật khẩu.',
      };
    }

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: normalizedEmail,
        passwordHash,
        role: dto.role as unknown as import('@prisma/client').Role,
        invitedById: inviterId,
        invitedAt: new Date(),
      },
    });

    await this.teamInviteService.sendInvite(user.id, inviterId);

    return {
      email: normalizedEmail,
      message: 'Đã gửi email mời. Thành viên cần mở link trong email để đặt mật khẩu.',
    };
  }

  async resendInvite(tenantId: string, memberId: string, inviterId: string) {
    const member = await this.prisma.user.findFirst({
      where: { id: memberId, tenantId },
    });

    if (!member) {
      throw new NotFoundException('Thành viên không tồn tại');
    }

    if (member.emailVerifiedAt) {
      throw new BadRequestException('Thành viên đã kích hoạt tài khoản');
    }

    if (!member.invitedById) {
      throw new BadRequestException('Không thể gửi lại lời mời cho tài khoản này');
    }

    await this.teamInviteService.sendInvite(member.id, inviterId);

    return {
      email: member.email,
      message: 'Đã gửi lại email mời.',
    };
  }

  async removeMember(tenantId: string, requesterId: string, memberId: string) {
    if (requesterId === memberId) {
      throw new BadRequestException('Không thể xóa chính mình');
    }

    const member = await this.prisma.user.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw new NotFoundException('Thành viên không tồn tại');

    if (member.role === 'admin') {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('Không thể xóa admin duy nhất của tenant');
      }
    }

    await this.prisma.user.delete({ where: { id: memberId } });
    return { success: true };
  }
}
