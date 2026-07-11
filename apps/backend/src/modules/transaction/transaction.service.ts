import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionSource, TransactionStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { paginateParams, paginateResult } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { AI_CLASSIFY_JOB } from '../ai/classification.constants';
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
    const { skip } = paginateParams(page, limit);

    const search = query.search?.trim();

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
      ...(search
        ? {
            OR: [
              { content: { contains: search, mode: 'insensitive' } },
              { transactionId: { contains: search, mode: 'insensitive' } },
              { senderAccount: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.source ? { source: query.source as TransactionSource } : {}),
    };

    const orderBy: Prisma.TransactionOrderByWithRelationInput[] =
      query.source === TransactionSource.import
        ? [{ createdAt: 'desc' }, { transactionDate: 'desc' }]
        : [{ transactionDate: 'desc' }, { createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        select: {
          id: true,
          transactionId: true,
          amount: true,
          content: true,
          senderAccount: true,
          status: true,
          transactionDate: true,
          source: true,
          direction: true,
          classification: {
            select: {
              debitAccount: true,
              creditAccount: true,
              confidenceScore: true,
              classificationType: true,
              status: true,
              reason: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return paginateResult(items, total, page, limit);
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

    await this.enqueueReclassify(transaction.id);

    return { success: true, status: transaction.status };
  }

  /** Đẩy lại job AI hàng loạt — chỉ enqueue GD thuộc tenant và đang pending. */
  async bulkReclassify(tenantId: string, ids: string[]) {
    const uniqueIds = [...new Set(ids)];

    const transactions = await this.prisma.transaction.findMany({
      where: { tenantId, id: { in: uniqueIds } },
      select: { id: true, status: true },
    });

    const foundById = new Map(transactions.map((txn) => [txn.id, txn]));
    let queued = 0;
    let skipped = 0;

    for (const id of uniqueIds) {
      const transaction = foundById.get(id);
      if (!transaction) {
        skipped += 1;
        continue;
      }
      if (transaction.status !== TransactionStatus.pending) {
        skipped += 1;
        continue;
      }
      await this.enqueueReclassify(transaction.id);
      queued += 1;
    }

    if (queued === 0) {
      throw new BadRequestException(
        'Không có giao dịch nào đủ điều kiện để định khoản lại (chỉ GD đang chờ xử lý)',
      );
    }

    return { queued, skipped };
  }

  private async enqueueReclassify(transactionDbId: string): Promise<void> {
    await this.webhookQueue.add(AI_CLASSIFY_JOB, { transactionDbId });
  }
}
