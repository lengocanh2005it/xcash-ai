import { createHash } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import type * as XLSX from 'xlsx';

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
export class ImportParserService {
  normalizeAmount(raw: unknown): number | null {
    if (raw === null || raw === undefined || raw === '') return null;
    const str = String(raw).replace(/[^\d]/g, '');
    if (!str) return null;
    const n = Number(str);
    return Number.isFinite(n) ? n : null;
  }

  parseDate(raw: unknown): Date | null {
    if (raw === null || raw === undefined || raw === '') return null;

    if (typeof raw !== 'number') {
      const fromString = this.parseDateString(String(raw).trim());
      if (fromString) return fromString;
    }

    if (typeof raw === 'number') {
      return this.parseExcelSerialDate(raw);
    }

    return null;
  }

  parseImportDate(
    cell: XLSX.CellObject | undefined,
    formattedValue: unknown,
  ): { date: Date | null; displayValue: string; errorMessage?: string } {
    const displayValue =
      this.getDateDisplayText(cell, formattedValue) ?? String(formattedValue ?? '');

    if (displayValue) {
      const date = this.parseDateString(displayValue);
      if (date) return { date, displayValue };
    }

    if (cell && typeof cell.v === 'number') {
      const hasDisplayText = displayValue && !/^\d+(\.\d+)?$/.test(displayValue);
      return {
        date: null,
        displayValue,
        errorMessage: hasDisplayText
          ? `Ngày "${displayValue}" không hợp lệ — dùng dd/MM/yyyy (vd 03/07/2026 cho 3 tháng 7).`
          : 'Cột Ngày đang là số Excel (ô căn phải). Chọn Format → Text, hoặc nhập dd/MM/yyyy (vd 01/07/2026 = 1 tháng 7).',
      };
    }

    return {
      date: null,
      displayValue,
      errorMessage: 'Ngày không hợp lệ (định dạng dd/MM/yyyy)',
    };
  }

  getDateDisplayText(cell: XLSX.CellObject | undefined, formattedValue: unknown): string | null {
    if (typeof formattedValue === 'string' && formattedValue.trim()) {
      return formattedValue.trim();
    }
    if (cell?.t === 's' && typeof cell.v === 'string') {
      return cell.v.trim();
    }
    if (typeof cell?.w === 'string' && cell.w.trim() && !/^\d+(\.\d+)?$/.test(cell.w.trim())) {
      return cell.w.trim();
    }
    if (cell && typeof cell.v === 'number' && cell.z) {
      const XLSX = require('xlsx') as typeof import('xlsx');
      const formatted = XLSX.SSF.format(cell.z, cell.v);
      if (formatted && !/^\d+(\.\d+)?$/.test(formatted.trim())) {
        return formatted.trim();
      }
    }
    return null;
  }

  private parseDateString(str: string): Date | null {
    if (!str) return null;

    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
    if (dmyMatch) {
      const [, dd, mm, yy] = dmyMatch;
      const day = Number(dd);
      const month = Number(mm);
      let year = Number(yy);
      if (yy.length === 2) {
        year = 2000 + year;
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      if (d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) return null;
      if (!Number.isNaN(d.getTime())) return d;
    }

    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const d = new Date(str);
      if (!Number.isNaN(d.getTime())) return d;
    }

    return null;
  }

  private parseExcelSerialDate(serial: number): Date | null {
    const XLSX = require('xlsx') as typeof import('xlsx');
    const d = XLSX.SSF.parse_date_code(serial);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d, 12, 0, 0));
    return null;
  }

  parseRows(buffer: Buffer): ParseResult {
    const XLSX = require('xlsx') as typeof import('xlsx');

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
    const formattedRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];

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
      const excelRow = i + 2;
      const cols = dataRows[i] as unknown[];

      if (cols.every((c) => c === '' || c === null || c === undefined)) continue;

      const dateCell = sheet[XLSX.utils.encode_cell({ r: i + 1, c: 0 })];
      const formattedDate = formattedRows[i + 1]?.[0];
      const rawDesc = cols[1];
      const rawAmount = cols[2];
      const rawDirection = cols[3];

      let hasError = false;

      const parsedDate = this.parseImportDate(dateCell, formattedDate);
      const date = parsedDate.date;
      if (!date) {
        errors.push({
          row: excelRow,
          column: 'Ngày',
          value: parsedDate.displayValue,
          message: parsedDate.errorMessage ?? 'Ngày không hợp lệ (định dạng dd/MM/yyyy)',
        });
        hasError = true;
      } else if (Date.now() - date.getTime() > TWO_YEARS_MS) {
        warnings.push({ row: excelRow, message: 'Ngày hơn 2 năm trước — vui lòng kiểm tra lại' });
      }

      const description = String(rawDesc ?? '').trim();
      if (!description) {
        errors.push({ row: excelRow, column: 'Mô tả', message: 'Mô tả không được để trống' });
        hasError = true;
      }

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
}
