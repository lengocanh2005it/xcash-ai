import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatVND } from '@/lib/format-vnd';
import type { AccountSummary } from '@/types/api/reports';

interface AccountTableProps {
  items: AccountSummary[];
}

export function AccountTable({ items }: AccountTableProps) {
  return (
    <>
      <div className="space-y-3 lg:hidden">
        {items.map((a) => (
          <Card key={a.accountCode} className="py-4">
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono font-semibold">{a.accountCode}</p>
                  <p className="text-muted-foreground">{a.accountName}</p>
                </div>
                <Badge variant="outline">{a.transactionCount} GD</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Phát sinh Nợ</p>
                  <p className="font-mono text-red-600">{formatVND(a.totalDebit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phát sinh Có</p>
                  <p className="font-mono text-green-600">{formatVND(a.totalCredit)}</p>
                </div>
              </div>
              <p
                className={`font-mono font-medium ${a.net >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                Số dư: {formatVND(a.net)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto lg:block">
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
            {items.map((a) => (
              <tr key={a.accountCode} className="hover:bg-muted/30">
                <td className="py-3 pr-4 font-mono font-medium">{a.accountCode}</td>
                <td className="py-3 pr-4">{a.accountName}</td>
                <td className="py-3 pr-4 font-mono text-red-600">{formatVND(a.totalDebit)}</td>
                <td className="py-3 pr-4 font-mono text-green-600">{formatVND(a.totalCredit)}</td>
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
    </>
  );
}
