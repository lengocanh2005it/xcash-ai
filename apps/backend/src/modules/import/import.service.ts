import { InjectQueue } from '@nestjs/bullmq';
import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  TransactionDirection as PrismaTransactionDirection,
  TransactionSource,
} from '@prisma/client';
import type { TransactionDirection } from '@xcash/shared-types';
import type { Queue } from 'bullmq';
import * as XLSX from 'xlsx';
import { createAuditLog } from '../../common/util/audit-log.util';
import { paginateParams, paginateResult } from '../../common/util/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { AI_CLASSIFY_JOB } from '../ai/classification.constants';
import { TransactionQuotaService } from '../billing/transaction-quota.service';
import { ImportParserService } from './import-parser.service';

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ImportParserService,
    private readonly transactionQuotaService: TransactionQuotaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  // ------------------------------------------------------------------ quota

  async getQuotaImpact(tenantId: string, rowCount: number) {
    const sub = await this.transactionQuotaService.getActiveSubscription(tenantId);
    if (!sub) return { willUse: rowCount, remaining: 0, willExceedQuota: true };
    const remaining = Math.max(0, sub.transactionQuota - sub.transactionUsedThisCycle);
    return { willUse: rowCount, remaining, willExceedQuota: rowCount > remaining };
  }

  // ------------------------------------------------------------------ validate (dry-run)

  async validate(tenantId: string, buffer: Buffer) {
    const { rows, errors, warnings } = this.parser.parseRows(buffer);

    if (errors.length > 0) {
      return {
        valid: false,
        totalRows: rows.length + errors.length,
        errorCount: errors.length,
        errors,
      };
    }

    const quotaImpact = await this.getQuotaImpact(tenantId, rows.length);

    const preview = rows.slice(0, 5).map((r) => ({
      row: r.row,
      date: r.dateIso,
      description: r.description,
      amount: r.amount,
      direction: r.direction as TransactionDirection,
    }));

    return {
      valid: true,
      totalRows: rows.length,
      quotaImpact,
      preview,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  }

  // ------------------------------------------------------------------ import

  async importRows(tenantId: string, userId: string, fileName: string, buffer: Buffer) {
    const { rows, errors } = this.parser.parseRows(buffer);

    if (errors.length > 0) {
      throw new ForbiddenException(
        `File có ${errors.length} lỗi — vui lòng validate trước khi import.`,
      );
    }

    const { subscription, willExceedQuota } =
      await this.transactionQuotaService.assertCanAcceptBatch(tenantId, rows.length);

    const batch = await this.prisma.transactionImportBatch.create({
      data: {
        tenantId,
        fileName,
        totalRows: rows.length,
        importedCount: 0,
        skippedCount: 0,
        importedBy: userId,
      },
    });

    let imported = 0;
    let skipped = 0;
    const skippedReasons: Array<{ row: number; reason: string }> = [];
    const enqueuedIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const transactionId = this.parser.generateTransactionId(tenantId, row.row, row);

        const existing = await tx.transaction.findUnique({ where: { transactionId } });
        if (existing) {
          skipped++;
          skippedReasons.push({ row: row.row, reason: 'Giao dịch đã tồn tại (upload trùng)' });
          continue;
        }

        const created = await tx.transaction.create({
          data: {
            tenantId,
            transactionId,
            amount: new Prisma.Decimal(row.amount),
            content: row.description,
            transactionDate: row.date,
            status: 'pending',
            source: TransactionSource.import,
            direction:
              row.direction === 'in'
                ? PrismaTransactionDirection.in
                : PrismaTransactionDirection.out,
            importBatchId: batch.id,
          },
        });

        await this.transactionQuotaService.incrementUsageInTx(
          tx as unknown as Parameters<typeof this.transactionQuotaService.incrementUsageInTx>[0],
          subscription,
          tenantId,
        );

        enqueuedIds.push(created.id);
        imported++;
      }

      await tx.transactionImportBatch.update({
        where: { id: batch.id },
        data: { importedCount: imported, skippedCount: skipped },
      });

      await createAuditLog(tx, {
        tenantId,
        entityType: 'transaction_import_batch',
        entityId: batch.id,
        action: 'transaction_import',
        actor: userId,
        afterState: { fileName, totalRows: rows.length, imported, skipped },
      });
    });

    for (const id of enqueuedIds) {
      await this.webhookQueue.add(AI_CLASSIFY_JOB, { transactionDbId: id });
    }

    void this.transactionQuotaService
      .notifyAfterBatch(subscription, tenantId, imported)
      .catch((err: unknown) => this.logger.warn('Quota notify failed', err));

    return {
      batchId: batch.id,
      imported,
      skipped,
      ...(skippedReasons.length > 0 ? { skippedReasons } : {}),
      ...(willExceedQuota
        ? { quotaWarning: 'Import vượt quota — phí vượt sẽ tính vào chu kỳ hiện tại' }
        : {}),
    };
  }

  // ------------------------------------------------------------------ history

  async getHistory(tenantId: string, page: number, limit: number) {
    const { skip } = paginateParams(page, limit);
    const [items, total] = await Promise.all([
      this.prisma.transactionImportBatch.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { tenant: false },
      }),
      this.prisma.transactionImportBatch.count({ where: { tenantId } }),
    ]);

    const userIds = [...new Set(items.map((i) => i.importedBy))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return paginateResult(
      items.map((i) => ({
        id: i.id,
        fileName: i.fileName,
        totalRows: i.totalRows,
        importedCount: i.importedCount,
        skippedCount: i.skippedCount,
        importedByName: userMap.get(i.importedBy) ?? i.importedBy,
        createdAt: i.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    );
  }

  // ------------------------------------------------------------------ template

  buildTemplate(): Buffer {
    const wb = XLSX.utils.book_new();
    const data = [
      ['Ngày', 'Mô tả', 'Số tiền', 'Loại'],
      ['01/07/2026', 'Mua nguyên liệu cafe', 2500000, 'Chi'],
      ['01/07/2026', 'Thu tiền bán hàng buổi sáng', 8000000, 'Thu'],
      ['02/07/2026', 'Trả lương nhân viên', 5000000, 'Chi'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);

    for (let r = 1; r <= 500; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: 0 });
      const cell = ws[ref];
      if (!cell) continue;
      const text = String(cell.v);
      ws[ref] = { t: 's', v: text, w: text };
    }

    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 8 }];

    if (!ws['!dataValidations']) ws['!dataValidations'] = [];
    (ws['!dataValidations'] as unknown[]).push({
      sqref: 'D2:D501',
      type: 'list',
      formula1: '"Thu,Chi"',
      showDropDown: false,
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch');

    const guide = XLSX.utils.aoa_to_sheet([
      ['HƯỚNG DẪN NHẬP LIỆU'],
      [],
      ['Cột', 'Định dạng', 'Ví dụ'],
      ['Ngày', 'dd/MM/yyyy', '01/07/2026 (= 1 tháng 7)'],
      ['Mô tả', 'Chuỗi ký tự, tối đa 500', 'Mua nguyên liệu cafe'],
      ['Số tiền', 'Số nguyên dương (VNĐ)', '2500000'],
      ['Loại', 'Thu hoặc Chi', 'Chi'],
      [],
      ['Lưu ý:'],
      ['- Định dạng ngày: dd/MM/yyyy (ngày/tháng/năm Việt Nam). Ví dụ 01/07/2026 = 1 tháng 7'],
      [
        '- Nếu ô Ngày căn phải sau khi gõ, Excel đang lưu dạng số — format cột Text (@) hoặc tải lại file mẫu',
      ],
      ['- Không xóa dòng tiêu đề (dòng 1)'],
      ['- Không nhập giao dịch trùng với sao kê ngân hàng đã liên kết'],
      ['- Tối đa 500 dòng mỗi lần upload'],
    ]);
    XLSX.utils.book_append_sheet(wb, guide, 'Hướng dẫn');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer);
  }
}
