import PdfPrinter from 'pdfmake';
import vfsFonts from 'pdfmake/build/vfs_fonts';
import type { ExcelExportContext } from './report-excel.util';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Tài sản',
  liability: 'Nợ phải trả',
  equity: 'Vốn chủ sở hữu',
  revenue: 'Doanh thu',
  expense: 'Chi phí',
  unknown: 'Khác',
};

const fonts = {
  Roboto: {
    normal: Buffer.from(vfsFonts['Roboto-Regular.ttf'], 'base64'),
    bold: Buffer.from(vfsFonts['Roboto-Medium.ttf'], 'base64'),
    italics: Buffer.from(vfsFonts['Roboto-Italic.ttf'], 'base64'),
    bolditalics: Buffer.from(vfsFonts['Roboto-MediumItalic.ttf'], 'base64'),
  },
};

const printer = new PdfPrinter(fonts);

function fmtVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN');
}

function formatPeriodLabel(fromDate: string, toDate: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  return `${fmt(fromDate)} – ${fmt(toDate)}`;
}

function pdfDocToBuffer(doc: NodeJS.ReadableStream & { end(): void }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export async function buildExportPdf(ctx: ExcelExportContext): Promise<Buffer> {
  const accountRows = ctx.accounts.map((a, i) => [
    String(i + 1),
    a.accountCode,
    a.accountName,
    ACCOUNT_TYPE_LABELS[a.accountType] ?? a.accountType,
    fmtVnd(a.totalDebit),
    fmtVnd(a.totalCredit),
    String(a.transactionCount),
  ]);

  const detailRows = ctx.details.map((d, i) => [
    String(i + 1),
    d.transactionDate.toLocaleDateString('vi-VN'),
    d.content,
    d.debitAccount,
    d.creditAccount,
    fmtVnd(d.amount),
    d.classificationType === 'auto' ? 'Tự động (AI)' : 'Thủ công',
  ]);

  const docDefinition = {
    pageMargins: [40, 60, 40, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 14, bold: true, margin: [0, 0, 0, 6] },
      section: { fontSize: 11, bold: true, margin: [0, 10, 0, 6] },
    },
    content: [
      { text: 'BÁO CÁO TỔNG HỢP ĐỊNH KHOẢN (TT133)', style: 'title' },
      { text: `Doanh nghiệp: ${ctx.businessName}` },
      { text: `Kỳ báo cáo: ${formatPeriodLabel(ctx.fromDate, ctx.toDate)}` },
      { text: `Ngày xuất: ${ctx.exportedAt.toLocaleDateString('vi-VN')}`, margin: [0, 0, 0, 10] },
      { text: 'I. Tổng hợp thu chi', style: 'section' },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ['Chỉ tiêu', 'Giá trị (VNĐ)'],
            ['Tổng doanh thu', fmtVnd(ctx.summary.totalRevenue)],
            ['Tổng chi phí', fmtVnd(ctx.summary.totalExpense)],
            ['Lãi / lỗ ròng', fmtVnd(ctx.summary.net)],
          ],
        },
        margin: [0, 0, 0, 10],
      },
      {
        text: `Số giao dịch: ${ctx.summary.totalCount} · Đã định khoản: ${ctx.summary.classifiedCount} · Chờ review: ${ctx.summary.reviewCount} · AI tự động: ${ctx.summary.aiAccuracy}%`,
        margin: [0, 0, 0, 10],
      },
      { text: 'II. Phân bổ theo tài khoản', style: 'section' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['STT', 'Mã TK', 'Tên tài khoản', 'Loại TK', 'PS Nợ', 'PS Có', 'Số GD'],
            ...(accountRows.length > 0
              ? accountRows
              : [['', '', 'Không có dữ liệu', '', '', '', '']]),
          ],
        },
        margin: [0, 0, 0, 10],
      },
      { text: 'III. Sổ chi tiết định khoản', style: 'section', pageBreak: 'before' },
      {
        table: {
          headerRows: 1,
          widths: ['auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            ['STT', 'Ngày', 'Diễn giải', 'TK Nợ', 'TK Có', 'Số tiền', 'Nguồn'],
            ...(detailRows.length > 0
              ? detailRows
              : [['', '', 'Không có giao dịch', '', '', '', '']]),
          ],
        },
      },
    ],
  };

  const doc = printer.createPdfKitDocument(docDefinition);
  return pdfDocToBuffer(doc);
}
