import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { InviteMemberDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

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
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(tenantId: string, inviterId: string, dto: InviteMemberDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email đã được sử dụng');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        tenantId,
        name: dto.name,
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role as unknown as import('@prisma/client').Role,
        invitedById: inviterId,
        invitedAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
  }

  async removeMember(tenantId: string, requesterId: string, memberId: string) {
    if (requesterId === memberId) {
      throw new BadRequestException('Không thể xóa chính mình');
    }

    const member = await this.prisma.user.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw new NotFoundException('Thành viên không tồn tại');

    // Prevent removing the last admin
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
