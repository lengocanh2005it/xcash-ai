import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { type AccountType, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';
import { TT133_ACCOUNTS } from './tt133-seed';

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async seedTt133(tenantId: string): Promise<void> {
    const existing = await this.prisma.chartOfAccount.count({ where: { tenantId } });
    if (existing > 0) return;

    await this.prisma.chartOfAccount.createMany({
      data: TT133_ACCOUNTS.map((a) => ({
        tenantId,
        accountCode: a.accountCode,
        accountName: a.accountName,
        accountType: a.accountType as AccountType,
        parentCode: a.parentCode,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.chartOfAccount.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ accountCode: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, tenantId },
    });
    if (!account) throw new NotFoundException('Tài khoản không tồn tại');
    return account;
  }

  async create(tenantId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { tenantId, accountCode: dto.accountCode },
    });
    if (existing) throw new ConflictException('Mã tài khoản đã tồn tại');

    return this.prisma.chartOfAccount.create({
      data: {
        tenantId,
        accountCode: dto.accountCode,
        accountName: dto.accountName,
        accountType: dto.accountType as AccountType,
        parentCode: dto.parentCode ?? null,
        isActive: true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(tenantId, id);
    return this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        accountName: dto.accountName,
        accountType: dto.accountType as AccountType | undefined,
        parentCode: dto.parentCode,
        isActive: dto.isActive,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.chartOfAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ── Copilot tool methods ─────────────────────────────────────────────────

  async findByCode(tenantId: string, accountCode: string) {
    return this.prisma.chartOfAccount.findFirst({
      where: { tenantId, accountCode },
      select: { accountCode: true, accountName: true, accountType: true, isActive: true },
    });
  }

  async listFiltered(tenantId: string, accountType?: string, limit = 50) {
    const validAccountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    const where: Prisma.ChartOfAccountWhereInput = {
      tenantId,
      isActive: true,
      ...(accountType && validAccountTypes.includes(accountType)
        ? { accountType: accountType as AccountType }
        : {}),
    };

    return this.prisma.chartOfAccount.findMany({
      where,
      select: { accountCode: true, accountName: true, accountType: true },
      orderBy: { accountCode: 'asc' },
      take: Math.min(100, Math.max(1, limit)),
    });
  }
}
