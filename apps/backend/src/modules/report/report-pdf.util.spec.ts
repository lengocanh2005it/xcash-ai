import { buildExportPdf } from './report-pdf.util';

describe('report-pdf.util', () => {
  const baseCtx = {
    businessName: 'Công ty Demo',
    fromDate: '2026-06-01',
    toDate: '2026-06-30',
    exportedAt: new Date('2026-07-04'),
    summary: {
      totalRevenue: 120_000_000,
      totalExpense: 45_000_000,
      net: 75_000_000,
      classifiedCount: 10,
      reviewCount: 2,
      totalCount: 12,
      aiAccuracy: 83,
    },
    accounts: [
      {
        accountCode: '511',
        accountName: 'Doanh thu bán hàng',
        accountType: 'revenue',
        totalDebit: 0,
        totalCredit: 120_000_000,
        transactionCount: 5,
      },
    ],
    details: [
      {
        transactionDate: new Date('2026-06-15'),
        content: 'Thanh toán hóa đơn điện',
        amount: 1_500_000,
        debitAccount: '642',
        creditAccount: '112',
        classificationType: 'auto',
        reason: 'Chi phí điện năng văn phòng',
      },
    ],
  };

  it('builds a non-empty PDF buffer starting with the PDF magic bytes', async () => {
    const buffer = await buildExportPdf(baseCtx);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });

  it('builds a valid PDF even with zero accounts/details', async () => {
    const buffer = await buildExportPdf({ ...baseCtx, accounts: [], details: [] });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
  });
});
