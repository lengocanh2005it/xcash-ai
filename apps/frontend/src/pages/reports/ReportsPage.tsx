import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface SummaryData {
  period: { year: number; month: number };
  summary: { totalRevenue: number; totalExpense: number; net: number };
  stats: { totalCount: number; classifiedCount: number; reviewCount: number; aiAccuracy: number };
  byAccount: Array<{
    accountCode: string;
    accountName: string;
    accountType: string;
    totalDebit: number;
    totalCredit: number;
    net: number;
    transactionCount: number;
  }>;
}

async function fetchSummary(year: number, month: number): Promise<SummaryData> {
  const res = await api.get(`/reports/summary?year=${year}&month=${month}`);
  return res.data.data;
}

function formatVND(amount: number) {
  return amount.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

const MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-summary', year, month],
    queryFn: () => fetchSummary(year, month),
  });

  const handleExport = async () => {
    try {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      const res = await api.get(`/reports/export?from=${from}&to=${to}`, {
        responseType: 'blob',
      });

      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-dinh-khoan-${from}-${to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống báo cáo Excel');
    } catch {
      toast.error('Không thể xuất báo cáo');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo định khoản</h1>
          <p className="text-sm text-muted-foreground">Tổng hợp thu chi theo tài khoản TT133</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => {
              const val = MONTHS.indexOf(m) + 1;
              return (
                <option key={m} value={val}>
                  {m}
                </option>
              );
            })}
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button onClick={handleExport} disabled={isLoading}>
            <Download className="mr-2 size-4" />
            Xuất Excel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(['revenue', 'expense', 'net', 'accuracy'] as const).map((k) => (
            <Card key={k}>
              <CardContent className="p-6">
                <div className="h-8 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Tổng thu</p>
                <p className="mt-1 text-2xl font-bold text-green-600">
                  {formatVND(data.summary.totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Tổng chi</p>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  {formatVND(data.summary.totalExpense)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Lãi/Lỗ</p>
                <p
                  className={`mt-1 text-2xl font-bold ${data.summary.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
                >
                  {formatVND(data.summary.net)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Độ chính xác AI</p>
                <p className="mt-1 text-2xl font-bold">{data.stats.aiAccuracy}%</p>
                <p className="text-xs text-muted-foreground">
                  {data.stats.classifiedCount}/{data.stats.totalCount} giao dịch
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Chi tiết theo tài khoản</CardTitle>
            </CardHeader>
            <CardContent>
              {!data.byAccount.length ? (
                <EmptyState
                  title="Chưa có dữ liệu"
                  description="Chưa có giao dịch nào được định khoản trong tháng này"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 pr-4 font-medium">Mã TK</th>
                        <th className="pb-3 pr-4 font-medium">Tên tài khoản</th>
                        <th className="pb-3 pr-4 font-medium">Phát sinh Nợ</th>
                        <th className="pb-3 pr-4 font-medium">Phát sinh Có</th>
                        <th className="pb-3 pr-4 font-medium">Số dư</th>
                        <th className="pb-3 font-medium">Số GD</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.byAccount.map((a) => (
                        <tr key={a.accountCode} className="hover:bg-muted/30">
                          <td className="py-3 pr-4 font-mono font-medium">{a.accountCode}</td>
                          <td className="py-3 pr-4">{a.accountName}</td>
                          <td className="py-3 pr-4 font-mono text-red-600">
                            {formatVND(a.totalDebit)}
                          </td>
                          <td className="py-3 pr-4 font-mono text-green-600">
                            {formatVND(a.totalCredit)}
                          </td>
                          <td
                            className={`py-3 pr-4 font-mono font-medium ${a.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
                          >
                            {formatVND(a.net)}
                          </td>
                          <td className="py-3 text-muted-foreground">{a.transactionCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
