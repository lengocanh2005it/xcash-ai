import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { AI_CLASSIFY_JOB } from '../ai/classification.processor';
import type { ListTransactionsQueryDto } from './dto/list-transactions.dto';

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  async findAll(tenantId: string, query: ListTransactionsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status as TransactionStatus } : {}),
      ...(query.from_date || query.to_date
        ? {
            transactionDate: {
              ...(query.from_date ? { gte: new Date(query.from_date) } : {}),
              ...(query.to_date ? { lte: new Date(query.to_date) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          classification: {
            select: {
              debitAccount: true,
              creditAccount: true,
              confidenceScore: true,
              classificationType: true,
              status: true,
            },
          },
        },
        orderBy: { transactionDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return { items, page, limit, total };
  }

  async findOne(tenantId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, tenantId },
      include: {
        classification: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }

    return transaction;
  }

  /** Đẩy lại job AI cho giao dịch đang chờ xử lý (pending) — worker sẽ định khoản lại. */
  async reclassify(tenantId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, tenantId },
      select: { id: true, status: true },
    });

    if (!transaction) {
      throw new NotFoundException('Không tìm thấy giao dịch');
    }

    if (transaction.status !== TransactionStatus.pending) {
      throw new BadRequestException(
        'Chỉ giao dịch đang chờ xử lý mới có thể yêu cầu AI định khoản',
      );
    }

    await this.webhookQueue.add(AI_CLASSIFY_JOB, { transactionDbId: transaction.id });

    return { success: true, status: transaction.status };
  }
}
