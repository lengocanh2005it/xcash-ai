import * as XLSX from 'xlsx';

const VND_FORMAT = '#,##0';
const DATE_FORMAT = 'dd/mm/yyyy';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Tài sản',
  liability: 'Nợ phải trả',
  equity: 'Vốn chủ sở hữu',
  revenue: 'Doanh thu',
  expense: 'Chi phí',
  unknown: 'Khác',
};

export interface ExcelExportContext {
  businessName: string;
  fromDate: string;
  toDate: string;
  exportedAt: Date;
  summary: {
    totalRevenue: number;
    totalExpense: number;
    net: number;
    classifiedCount: number;
    reviewCount: number;
    totalCount: number;
    aiAccuracy: number;
  };
  accounts: Array<{
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebit: number;
    totalCredit: number;
    transactionCount: number;
  }>;
  details: ExcelDetailRow[];
}

export interface ExcelDetailRow {
  transactionDate: Date;
  content: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  classificationType: string;
  reason: string | null;
}

function colLetter(col: number): string {
  let n = col + 1;
  let s = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number,
  format?: string,
): void {
  const ref = `${colLetter(col)}${row + 1}`;
  if (typeof value === 'number') {
    ws[ref] = { t: 'n', v: value, ...(format ? { z: format } : {}) };
  } else {
    ws[ref] = { t: 's', v: value };
  }
}

function dateToExcelSerial(date: Date): number {
  return (
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(1899, 11, 30)) /
    86400000
  );
}

function formatPeriodLabel(fromDate: string, toDate: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmt(fromDate)} – ${fmt(toDate)}`;
}

function appendAoa(
  ws: XLSX.WorkSheet,
  rows: (string | number | null)[][],
  startRow: number,
): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const value = row[j];
      if (value === null || value === undefined) continue;
      setCell(ws, startRow + i, j, value);
    }
  }
  return startRow + rows.length;
}

function updateSheetRange(ws: XLSX.WorkSheet, rowCount: number, colCount: number): void {
  ws['!ref'] = `A1:${colLetter(colCount - 1)}${rowCount}`;
}

export function buildSummarySheet(ctx: ExcelExportContext): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let row = 0;

  const headerRows: (string | number | null)[][] = [
    ['BÁO CÁO TỔNG HỢP ĐỊNH KHOẢN (TT133)'],
    [`Doanh nghiệp: ${ctx.businessName}`],
    [`Kỳ báo cáo: ${formatPeriodLabel(ctx.fromDate, ctx.toDate)}`],
    [`Ngày xuất: ${ctx.exportedAt.toLocaleDateString('vi-VN')}`],
    [null],
    ['I. TỔNG HỢP THU CHI'],
    ['Chỉ tiêu', 'Giá trị (VNĐ)'],
    ['Tổng doanh thu', ctx.summary.totalRevenue],
    ['Tổng chi phí', ctx.summary.totalExpense],
    ['Lãi / lỗ ròng', ctx.summary.net],
    [null],
    ['Chỉ tiêu vận hành', 'Giá trị'],
    ['Số giao dịch trong kỳ', ctx.summary.totalCount],
    ['Số giao dịch đã định khoản', ctx.summary.classifiedCount],
    ['Số giao dịch chờ review', ctx.summary.reviewCount],
    ['Tỷ lệ AI tự động (%)', ctx.summary.aiAccuracy],
    [null],
    ['II. PHÂN BỔ THEO TÀI KHOẢN'],
    ['STT', 'Mã TK', 'Tên tài khoản', 'Loại TK', 'PS Nợ', 'PS Có', 'Số GD'],
  ];
  row = appendAoa(ws, headerRows, row);

  let totalDebit = 0;
  let totalCredit = 0;
  let totalTx = 0;

  for (let i = 0; i < ctx.accounts.length; i++) {
    const a = ctx.accounts[i];
    if (!a) continue;
    totalDebit += a.totalDebit;
    totalCredit += a.totalCredit;
    totalTx += a.transactionCount;
    setCell(ws, row, 0, i + 1);
    setCell(ws, row, 1, a.accountCode);
    setCell(ws, row, 2, a.accountName);
    setCell(ws, row, 3, ACCOUNT_TYPE_LABELS[a.accountType] ?? a.accountType);
    setCell(ws, row, 4, a.totalDebit, VND_FORMAT);
    setCell(ws, row, 5, a.totalCredit, VND_FORMAT);
    setCell(ws, row, 6, a.transactionCount);
    row++;
  }

  setCell(ws, row, 0, '');
  setCell(ws, row, 1, '');
  setCell(ws, row, 2, 'TỔNG CỘNG');
  setCell(ws, row, 3, '');
  setCell(ws, row, 4, totalDebit, VND_FORMAT);
  setCell(ws, row, 5, totalCredit, VND_FORMAT);
  setCell(ws, row, 6, totalTx);
  row++;

  appendAoa(
    ws,
    [
      [null],
      [
        'Ghi chú: Báo cáo theo chuẩn Thông tư 133/2016/TT-BTC. PS Nợ / PS Có phản ánh phát sinh từ các giao dịch đã định khoản (trạng thái classified).',
      ],
    ],
    row,
  );
  row += 2;

  ws['!cols'] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 36 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
  ];

  updateSheetRange(ws, row, 7);
  return ws;
}

export function buildDetailSheet(ctx: ExcelExportContext): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let row = 0;

  const headerRows: (string | number | null)[][] = [
    ['SỔ CHI TIẾT ĐỊNH KHOẢN'],
    [`Doanh nghiệp: ${ctx.businessName}`],
    [`Kỳ báo cáo: ${formatPeriodLabel(ctx.fromDate, ctx.toDate)}`],
    [null],
    [
      'STT',
      'Ngày chứng từ',
      'Diễn giải',
      'TK Nợ',
      'PS Nợ',
      'TK Có',
      'PS Có',
      'Nguồn',
      'Ghi chú AI',
    ],
  ];
  row = appendAoa(ws, headerRows, row);

  const dataStartRow = row;
  let totalAmount = 0;

  for (let i = 0; i < ctx.details.length; i++) {
    const d = ctx.details[i];
    if (!d) continue;
    totalAmount += d.amount;
    setCell(ws, row, 0, i + 1);
    setCell(ws, row, 1, dateToExcelSerial(d.transactionDate), DATE_FORMAT);
    setCell(ws, row, 2, d.content);
    setCell(ws, row, 3, d.debitAccount);
    setCell(ws, row, 4, d.amount, VND_FORMAT);
    setCell(ws, row, 5, d.creditAccount);
    setCell(ws, row, 6, d.amount, VND_FORMAT);
    setCell(ws, row, 7, d.classificationType === 'auto' ? 'Tự động (AI)' : 'Thủ công');
    setCell(ws, row, 8, d.reason ?? '');
    row++;
  }

  if (ctx.details.length > 0) {
    setCell(ws, row, 0, '');
    setCell(ws, row, 1, '');
    setCell(ws, row, 2, 'TỔNG CỘNG');
    setCell(ws, row, 3, '');
    setCell(ws, row, 4, totalAmount, VND_FORMAT);
    setCell(ws, row, 5, '');
    setCell(ws, row, 6, totalAmount, VND_FORMAT);
    row++;
  }

  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 48 },
    { wch: 10 },
    { wch: 16 },
    { wch: 10 },
    { wch: 16 },
    { wch: 14 },
    { wch: 40 },
  ];

  // Freeze header row (row index 4 = "STT | Ngày chứng từ | ...")
  ws['!freeze'] = {
    xSplit: 0,
    ySplit: dataStartRow,
    topLeftCell: `A${dataStartRow + 1}`,
    activePane: 'bottomLeft',
  };

  updateSheetRange(ws, row, 9);
  return ws;
}

export function buildExportWorkbook(ctx: ExcelExportContext): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSummarySheet(ctx), 'Tổng hợp');
  XLSX.utils.book_append_sheet(wb, buildDetailSheet(ctx), 'Chi tiết');
  return wb;
}
