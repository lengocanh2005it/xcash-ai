import { createHash } from 'node:crypto';
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
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_QUEUE } from '../../queue/queue.module';
import { AI_CLASSIFY_JOB } from '../ai/classification.processor';
import { TransactionQuotaService } from '../billing/transaction-quota.service';

const MAX_ROWS = 500;
const MAX_DESC_LEN = 500;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

export interface ParsedRow {
  row: number;
  date: Date;
  dateIso: string;
  description: string;
  amount: number;
  direction: 'in' | 'out';
}

export interface RowError {
  row: number;
  column?: string;
  value?: string;
  message: string;
}

export interface RowWarning {
  row: number;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: RowError[];
  warnings: RowWarning[];
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionQuotaService: TransactionQuotaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly webhookQueue: Queue,
  ) {}

  // ------------------------------------------------------------------ parsing

  normalizeAmount(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const str = String(raw).replace(/[^\d]/g, ''); // strip everything non-digit
    if (!str) return null;
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  parseDate(raw: unknown): Date | null {
    if (!raw) return null;

    // Excel serial number
    if (typeof raw === 'number') {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    }

    const str = String(raw).trim();

    // dd/MM/yyyy or dd-MM-yyyy
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const [, dd, mm, yyyy] = dmyMatch;
      const day = Number(dd);
      const month = Number(mm);
      const year = Number(yyyy);
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      const d = new Date(Date.UTC(year, month - 1, day));
      // Verify no overflow (e.g., day=32 rolls over)
      if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) return null;
      if (!Number.isNaN(d.getTime())) return d;
    }

    // yyyy-MM-dd
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) return d;
    }

    return null;
  }

  parseRows(buffer: Buffer): ParseResult {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    } catch {
      throw new ForbiddenException(
        'Không thể đọc file. Vui lòng kiểm tra file không bị bảo vệ hoặc hỏng.',
      );
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown[][];

    // row 0 = header, skip
    const dataRows = raw.slice(1);

    if (dataRows.length > MAX_ROWS) {
      throw new ForbiddenException(
        `File có ${dataRows.length} dòng — tối đa ${MAX_ROWS} dòng/lần upload.`,
      );
    }

    const rows: ParsedRow[] = [];
    const errors: RowError[] = [];
    const warnings: RowWarning[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const excelRow = i + 2; // excel row number (1-indexed, +1 for header)
      const cols = dataRows[i] as unknown[];

      // skip fully empty rows
      if (cols.every((c) => c === '' || c === null || c === undefined)) continue;

      const rawDate = cols[0];
      const rawDesc = cols[1];
      const rawAmount = cols[2];
      const rawDirection = cols[3];

      let hasError = false;

      // -- date
      const date = this.parseDate(rawDate);
      if (!date) {
        errors.push({
          row: excelRow,
          column: 'Ngày',
          value: String(rawDate),
          message: 'Ngày không hợp lệ (định dạng dd/MM/yyyy)',
        });
        hasError = true;
      } else if (Date.now() - date.getTime() > TWO_YEARS_MS) {
        warnings.push({ row: excelRow, message: 'Ngày hơn 2 năm trước — vui lòng kiểm tra lại' });
      }

      // -- description
      const description = String(rawDesc ?? '').trim();
      if (!description) {
        errors.push({ row: excelRow, column: 'Mô tả', message: 'Mô tả không được để trống' });
        hasError = true;
      }

      // -- amount
      if (rawAmount === '' || rawAmount === null || rawAmount === undefined) {
        errors.push({ row: excelRow, column: 'Số tiền', message: 'Số tiền không được để trống' });
        hasError = true;
      } else {
        const amount = this.normalizeAmount(rawAmount);
        if (amount === null || amount <= 0) {
          errors.push({
            row: excelRow,
            column: 'Số tiền',
            value: String(rawAmount),
            message: 'Số tiền phải là số nguyên dương',
          });
          hasError = true;
        }
      }

      // -- direction
      const dirRaw = String(rawDirection ?? '')
        .trim()
        .toLowerCase();
      if (dirRaw !== 'thu' && dirRaw !== 'chi') {
        errors.push({
          row: excelRow,
          column: 'Loại',
          value: String(rawDirection),
          message: "Loại phải là 'Thu' hoặc 'Chi'",
        });
        hasError = true;
      }

      if (!hasError && date) {
        const amount = this.normalizeAmount(rawAmount) as number;
        const direction: 'in' | 'out' = dirRaw === 'thu' ? 'in' : 'out';
        const desc =
          description.length > MAX_DESC_LEN ? description.slice(0, MAX_DESC_LEN) : description;
        if (description.length > MAX_DESC_LEN) {
          warnings.push({
            row: excelRow,
            message: `Mô tả quá dài — đã cắt còn ${MAX_DESC_LEN} ký tự`,
          });
        }
        rows.push({
          row: excelRow,
          date,
          dateIso: date.toISOString().slice(0, 10),
          description: desc,
          amount,
          direction,
        });
      }
    }

    return { rows, errors, warnings };
  }

  generateTransactionId(tenantId: string, rowIndex: number, row: ParsedRow): string {
    const payload = `${row.dateIso}|${rowIndex}|${row.description.trim().toLowerCase()}|${row.amount}|${row.direction}`;
    const hash = createHash('sha256').update(payload).digest('hex');
    return `import_${tenantId}_${hash}`;
  }

  // ------------------------------------------------------------------ quota

  async getQuotaImpact(tenantId: string, rowCount: number) {
    const sub = await this.transactionQuotaService.getActiveSubscription(tenantId);
    if (!sub) return { willUse: rowCount, remaining: 0, willExceedQuota: true };
    const remaining = Math.max(0, sub.transactionQuota - sub.transactionUsedThisCycle);
    return { willUse: rowCount, remaining, willExceedQuota: rowCount > remaining };
  }

  // ------------------------------------------------------------------ validate (dry-run)

  async validate(tenantId: string, buffer: Buffer) {
    const { rows, errors, warnings } = this.parseRows(buffer);

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
    const { rows, errors } = this.parseRows(buffer);

    if (errors.length > 0) {
      throw new ForbiddenException(
        `File có ${errors.length} lỗi — vui lòng validate trước khi import.`,
      );
    }

    const { subscription, willExceedQuota } =
      await this.transactionQuotaService.assertCanAcceptBatch(tenantId, rows.length);

    // Create batch record
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

    // Process each row in a single Prisma transaction
    await this.prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const transactionId = this.generateTransactionId(tenantId, row.row, row);

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

      await tx.auditLog.create({
        data: {
          tenantId,
          entityType: 'transaction_import_batch',
          entityId: batch.id,
          action: 'transaction_import',
          actor: userId,
          afterState: { fileName, totalRows: rows.length, imported, skipped },
        },
      });
    });

    // Enqueue AI classify jobs
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
    const skip = (page - 1) * limit;
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

    return {
      items: items.map((i) => ({
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
    };
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

    // Column widths
    ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 16 }, { wch: 8 }];

    // Data validation for Loại column (D2:D501)
    if (!ws['!dataValidations']) ws['!dataValidations'] = [];
    (ws['!dataValidations'] as unknown[]).push({
      sqref: 'D2:D501',
      type: 'list',
      formula1: '"Thu,Chi"',
      showDropDown: false,
    });

    XLSX.utils.book_append_sheet(wb, ws, 'Giao dịch');

    // Guide sheet
    const guide = XLSX.utils.aoa_to_sheet([
      ['HƯỚNG DẪN NHẬP LIỆU'],
      [],
      ['Cột', 'Định dạng', 'Ví dụ'],
      ['Ngày', 'dd/MM/yyyy', '01/07/2026'],
      ['Mô tả', 'Chuỗi ký tự, tối đa 500', 'Mua nguyên liệu cafe'],
      ['Số tiền', 'Số nguyên dương (VNĐ)', '2500000'],
      ['Loại', 'Thu hoặc Chi', 'Chi'],
      [],
      ['Lưu ý:'],
      ['- Không xóa dòng tiêu đề (dòng 1)'],
      ['- Không nhập giao dịch trùng với sao kê ngân hàng đã liên kết'],
      ['- Tối đa 500 dòng mỗi lần upload'],
    ]);
    XLSX.utils.book_append_sheet(wb, guide, 'Hướng dẫn');

    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer);
  }
}
