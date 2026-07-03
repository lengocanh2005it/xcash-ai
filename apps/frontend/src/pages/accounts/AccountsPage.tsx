import { useQuery } from '@tanstack/react-query';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

interface Account {
  id: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentCode: string | null;
  isActive: boolean;
}

async function fetchAccounts(): Promise<Account[]> {
  const res = await api.get('/accounts');
  return res.data.data;
}

const ACCOUNT_TYPE_LABELS: Record<string, { label: string; className: string }> = {
  asset: {
    label: 'Tài sản',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  liability: {
    label: 'Nợ phải trả',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  equity: {
    label: 'Vốn chủ sở hữu',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  revenue: {
    label: 'Doanh thu',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  expense: {
    label: 'Chi phí',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
};

export default function AccountsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const grouped = data
    ? data.reduce<Record<string, Account[]>>((acc, a) => {
        const group = a.accountCode.charAt(0);
        if (!acc[group]) acc[group] = [];
        acc[group].push(a);
        return acc;
      }, {})
    : {};

  return (
    <>
      <Header
        title="Danh mục tài khoản"
        description="Hệ thống tài khoản kế toán theo chuẩn TT133/2016/TT-BTC"
      />
      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Tài khoản TT133
              {data ? (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({data.length} tài khoản)
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={10} columns={4} />
            ) : !data?.length ? (
              <EmptyState
                title="Chưa có tài khoản"
                description="Hệ thống sẽ tự động khởi tạo danh mục TT133 khi đăng ký"
              />
            ) : (
              <div className="space-y-6">
                {Object.entries(grouped)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([group, accounts]) => (
                    <div key={group}>
                      <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Nhóm {group}
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">Mã TK</th>
                              <th className="pb-2 pr-4 font-medium">Tên tài khoản</th>
                              <th className="pb-2 pr-4 font-medium">Loại</th>
                              <th className="pb-2 font-medium">TK cha</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {accounts.map((a) => {
                              const typeInfo = ACCOUNT_TYPE_LABELS[a.accountType];
                              return (
                                <tr key={a.id} className="hover:bg-muted/30">
                                  <td className="py-2 pr-4 font-mono font-medium">
                                    {a.accountCode}
                                  </td>
                                  <td className="py-2 pr-4">{a.accountName}</td>
                                  <td className="py-2 pr-4">
                                    {typeInfo ? (
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeInfo.className}`}
                                      >
                                        {typeInfo.label}
                                      </span>
                                    ) : (
                                      <Badge variant="secondary">{a.accountType}</Badge>
                                    )}
                                  </td>
                                  <td className="py-2 font-mono text-muted-foreground">
                                    {a.parentCode ?? '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
