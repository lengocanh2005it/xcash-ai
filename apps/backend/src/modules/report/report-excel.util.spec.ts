import * as XLSX from 'xlsx';
import { buildExportWorkbook } from './report-excel.util';

describe('report-excel.util', () => {
  it('builds workbook with summary and detail sheets', () => {
    const wb = buildExportWorkbook({
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
        {
          accountCode: '642',
          accountName: 'Chi phí quản lý doanh nghiệp',
          accountType: 'expense',
          totalDebit: 45_000_000,
          totalCredit: 0,
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
    });

    expect(wb.SheetNames).toEqual(['Tổng hợp', 'Chi tiết']);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    expect(buffer.length).toBeGreaterThan(0);

    const parsed = XLSX.read(buffer, { type: 'buffer' });
    const summary = parsed.Sheets['Tổng hợp'];
    const detail = parsed.Sheets['Chi tiết'];

    expect(summary?.A1?.v).toBe('BÁO CÁO TỔNG HỢP ĐỊNH KHOẢN (TT133)');
    expect(summary?.A2?.v).toContain('Công ty Demo');
    expect(detail?.A1?.v).toBe('SỔ CHI TIẾT ĐỊNH KHOẢN');
    expect(detail?.E6?.v).toBe(1_500_000);
    expect(detail?.G6?.v).toBe(1_500_000);
  });
});
