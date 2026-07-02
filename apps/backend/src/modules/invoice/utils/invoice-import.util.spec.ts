import * as XLSX from 'xlsx';
import {
  generateInvoiceImportTemplate,
  parseInvoiceImportBuffer,
  validateImportHeaders,
} from './invoice-import.util';

describe('invoice-import.util', () => {
  it('accepts Vietnamese column headers', () => {
    const error = validateImportHeaders(['ma_hoa_don', 'ten_khach_hang', 'so_tien']);
    expect(error).toBeNull();
  });

  it('rejects file missing required headers', () => {
    const error = validateImportHeaders(['ma_hoa_don', 'ghi_chu']);
    expect(error).toContain('ten_khach_hang');
    expect(error).toContain('so_tien');
  });

  it('reports row-level validation errors', () => {
    const workbookBuffer = generateInvoiceImportTemplate();
    const wb = XLSX.read(workbookBuffer, { type: 'buffer' });
    const sheet = wb.Sheets.Hoa_don;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    rows.push(['', 'Thiếu mã', 100000, '', '', '']);

    const badSheet = XLSX.utils.aoa_to_sheet(rows);
    const badWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(badWb, badSheet, 'Hoa_don');
    const badBuffer = XLSX.write(badWb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const badParsed = parseInvoiceImportBuffer(badBuffer);
    expect(badParsed.errors.some((e) => e.includes('thiếu mã hóa đơn'))).toBe(true);
    expect(badParsed.validRows).toHaveLength(2);
  });

  it('generates a non-empty template file', () => {
    const buffer = generateInvoiceImportTemplate();
    expect(buffer.length).toBeGreaterThan(100);

    const parsed = parseInvoiceImportBuffer(buffer);
    expect(parsed.headerError).toBeNull();
    expect(parsed.validRows).toHaveLength(2);
    expect(parsed.validRows[0]?.source_row_number).toBe(2);
  });
});
