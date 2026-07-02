import * as XLSX from 'xlsx';

export const INVOICE_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const INVOICE_IMPORT_MAX_ROWS = 500;
export const INVOICE_IMPORT_TEMPLATE_FILENAME = 'paypilot-import-hoa-don-mau.xlsx';

export interface ImportRow {
  invoice_code: string;
  customer_name: string;
  amount: number;
  due_date?: string;
  phone?: string;
  email?: string;
  source_row_number: number;
}

export interface InvoiceImportParseResult {
  validRows: ImportRow[];
  errors: string[];
  skippedEmptyRows: number;
  headerError: string | null;
}

const REQUIRED_COLUMNS = {
  invoice_code: ['invoice_code', 'ma_hoa_don', 'ma_hd', 'invoice'],
  customer_name: ['customer_name', 'ten_khach_hang', 'khach_hang', 'customer'],
  amount: ['amount', 'so_tien', 'tien'],
} as const;

const OPTIONAL_COLUMNS = {
  due_date: ['due_date', 'han_thanh_toan', 'due'],
  phone: ['phone', 'sdt', 'so_dien_thoai'],
  email: ['email'],
} as const;

export function normalizeImportHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, '_').trim();
}

function getRowValue(row: Record<string, unknown>, aliases: readonly string[]): string {
  for (const alias of aliases) {
    const found = Object.entries(row).find(([key]) => normalizeImportHeader(key) === alias);
    if (found && String(found[1]).trim()) {
      return String(found[1]).trim();
    }
  }
  return '';
}

function isRowEmpty(row: Record<string, unknown>): boolean {
  return Object.values(row).every((value) => !String(value ?? '').trim());
}

function hasAnyColumn(headers: string[], aliases: readonly string[]): boolean {
  const normalized = headers.map(normalizeImportHeader);
  return aliases.some((alias) => normalized.includes(alias));
}

export function validateImportHeaders(headers: string[]): string | null {
  const missing: string[] = [];

  if (!hasAnyColumn(headers, REQUIRED_COLUMNS.invoice_code)) {
    missing.push('ma_hoa_don (hoặc invoice_code)');
  }
  if (!hasAnyColumn(headers, REQUIRED_COLUMNS.customer_name)) {
    missing.push('ten_khach_hang (hoặc customer_name)');
  }
  if (!hasAnyColumn(headers, REQUIRED_COLUMNS.amount)) {
    missing.push('so_tien (hoặc amount)');
  }

  if (missing.length === 0) {
    return null;
  }

  return `File thiếu cột bắt buộc: ${missing.join(', ')}. Vui lòng tải file mẫu tại GET /api/v1/invoices/import/template và giữ nguyên dòng tiêu đề.`;
}

function validateImportRow(
  row: Record<string, unknown>,
  rowNumber: number,
): { row: ImportRow | null; errors: string[] } {
  if (isRowEmpty(row)) {
    return { row: null, errors: [] };
  }

  const invoiceCode = getRowValue(row, REQUIRED_COLUMNS.invoice_code);
  const customerName = getRowValue(row, REQUIRED_COLUMNS.customer_name);
  const amountRaw = getRowValue(row, REQUIRED_COLUMNS.amount);
  const amount = Number.parseFloat(amountRaw.replace(/[^\d.]/g, ''));

  const errors: string[] = [];

  if (!invoiceCode) {
    errors.push(`Dòng ${rowNumber}: thiếu mã hóa đơn (cột ma_hoa_don / invoice_code)`);
  }
  if (!customerName) {
    errors.push(`Dòng ${rowNumber}: thiếu tên khách hàng (cột ten_khach_hang / customer_name)`);
  }
  if (!amountRaw) {
    errors.push(`Dòng ${rowNumber}: thiếu số tiền (cột so_tien / amount)`);
  } else if (!Number.isFinite(amount) || amount <= 0) {
    errors.push(`Dòng ${rowNumber}: số tiền không hợp lệ — chỉ nhập số, ví dụ 350000`);
  }

  if (errors.length > 0) {
    return { row: null, errors };
  }

  const dueDate = getRowValue(row, OPTIONAL_COLUMNS.due_date);
  const phone = getRowValue(row, OPTIONAL_COLUMNS.phone);
  const email = getRowValue(row, OPTIONAL_COLUMNS.email);

  return {
    row: {
      invoice_code: invoiceCode,
      customer_name: customerName,
      amount,
      source_row_number: rowNumber,
      ...(dueDate ? { due_date: dueDate } : {}),
      ...(phone ? { phone } : {}),
      ...(email ? { email } : {}),
    },
    errors: [],
  };
}

export function parseInvoiceImportBuffer(buffer: Buffer): InvoiceImportParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      validRows: [],
      errors: [],
      skippedEmptyRows: 0,
      headerError: 'File Excel không có sheet nào. Vui lòng dùng file .xlsx có ít nhất 1 sheet.',
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (matrix.length === 0) {
    return {
      validRows: [],
      errors: [],
      skippedEmptyRows: 0,
      headerError: 'File Excel trống. Vui lòng thêm dòng tiêu đề và ít nhất 1 dòng dữ liệu.',
    };
  }

  const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? '').trim()).filter(Boolean);
  const headerError = validateImportHeaders(headerRow);

  if (headerError) {
    return { validRows: [], errors: [], skippedEmptyRows: 0, headerError };
  }

  const validRows: ImportRow[] = [];
  const errors: string[] = [];
  let skippedEmptyRows = 0;

  const dataRows = matrix.slice(1);

  if (dataRows.length > INVOICE_IMPORT_MAX_ROWS) {
    return {
      validRows: [],
      errors: [],
      skippedEmptyRows: 0,
      headerError: `File vượt quá ${INVOICE_IMPORT_MAX_ROWS} dòng dữ liệu. Vui lòng chia nhỏ file hoặc liên hệ hỗ trợ.`,
    };
  }

  for (const [index, cells] of dataRows.entries()) {
    const rowNumber = index + 2;
    const rowObject: Record<string, unknown> = {};

    for (const [colIndex, header] of headerRow.entries()) {
      if (!header) continue;
      rowObject[header] = (cells as unknown[])[colIndex] ?? '';
    }

    const result = validateImportRow(rowObject, rowNumber);

    if (isRowEmpty(rowObject)) {
      skippedEmptyRows += 1;
      continue;
    }

    if (result.row) {
      validRows.push(result.row);
    }

    errors.push(...result.errors);
  }

  return { validRows, errors, skippedEmptyRows, headerError: null };
}

export function generateInvoiceImportTemplate(): Buffer {
  const rows = [
    ['ma_hoa_don', 'ten_khach_hang', 'so_tien', 'han_thanh_toan', 'sdt', 'email'],
    ['HD1025', 'Nguyễn Văn A', 350000, '2026-12-31', '0901234567', ''],
    ['HD1026', 'Trần Thị B', 500000, '', '0912345678', 'tranb@example.com'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
    { wch: 24 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hoa_don');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
