import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { TransactionStatusBadge } from '@/components/shared/TransactionStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiData } from '@/lib/api';
import { formatTransactionTime } from '@/lib/dashboard-transactions';
import type { TransactionListResponse, TransactionSummary } from '@/types/transaction';
import { TransactionDetailSheet } from './TransactionDetailSheet';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'pending', label: 'Chờ xử lý' },
  { value: 'classified', label: 'Đã định khoản' },
  { value: 'review', label: 'Cần review' },
  { value: 'skipped', label: 'Bỏ qua' },
];

function buildTransactionsUrl(params: {
  page: number;
  status: string;
  fromDate: string;
  toDate: string;
}) {
  const search = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });

  if (params.status) {
    search.set('status', params.status);
  }
  if (params.fromDate) {
    search.set('from_date', new Date(params.fromDate).toISOString());
  }
  if (params.toDate) {
    const end = new Date(params.toDate);
    end.setHours(23, 59, 59, 999);
    search.set('to_date', end.toISOString());
  }

  return `/transactions?${search.toString()}`;
}

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<TransactionSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const queryUrl = buildTransactionsUrl({ page, status, fromDate, toDate });
  const hasActiveFilters = Boolean(status || fromDate || toDate || searchText);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['transactions', page, status, fromDate, toDate],
    queryFn: () => getApiData<TransactionListResponse>(queryUrl),
    refetchInterval: 10_000,
  });

  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!searchText.trim()) {
      return items;
    }

    const keyword = searchText.trim().toLowerCase();
    return items.filter(
      (txn) =>
        txn.content?.toLowerCase().includes(keyword) ||
        txn.transactionId.toLowerCase().includes(keyword) ||
        txn.senderAccount?.toLowerCase().includes(keyword),
    );
  }, [data?.items, searchText]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  function openDetail(txn: TransactionSummary) {
    setSelectedTxn(txn);
    setSheetOpen(true);
  }

  function clearFilters() {
    setStatus('');
    setFromDate('');
    setToDate('');
    setSearchText('');
    setPage(1);
  }

  return (
    <>
      <Header
        title="Giao dịch"
        description="Danh sách giao dịch ngân hàng nhận qua Cas Balance Hook"
        actions={
          <Button variant="link" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Đang tải...' : 'Làm mới'}
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <Card className="py-4">
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="txn-search">Tìm nội dung</Label>
                <Input
                  id="txn-search"
                  placeholder="Tìm theo nội dung, mã GD, người gửi..."
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="txn-status">Trạng thái</Label>
                <Select
                  value={status || 'all'}
                  onValueChange={(value) => {
                    setStatus(value === 'all' ? '' : value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="txn-status" className="w-full">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="txn-from">Từ ngày</Label>
                  <Input
                    id="txn-from"
                    type="date"
                    value={fromDate}
                    onChange={(event) => {
                      setFromDate(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="txn-to">Đến ngày</Label>
                  <Input
                    id="txn-to"
                    type="date"
                    value={toDate}
                    onChange={(event) => {
                      setToDate(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Đang lọc:</span>
                {status ? <Badge variant="secondary">Trạng thái: {status}</Badge> : null}
                {fromDate ? <Badge variant="secondary">Từ {fromDate}</Badge> : null}
                {toDate ? <Badge variant="secondary">Đến {toDate}</Badge> : null}
                {searchText ? <Badge variant="secondary">"{searchText}"</Badge> : null}
                <Button variant="link" size="sm" className="h-auto px-1" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {isLoading ? (
          <TableSkeleton rows={5} columns={7} />
        ) : isError ? (
          <Card className="border-destructive/30 bg-destructive/5 py-6">
            <CardContent className="text-center">
              <p className="text-sm text-destructive">Không thể tải danh sách giao dịch</p>
              <Button variant="link" size="sm" className="mt-3" onClick={() => refetch()}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        ) : !filteredItems.length ? (
          <EmptyState
            icon={Receipt}
            title="Không tìm thấy giao dịch nào"
            description={
              hasActiveFilters
                ? 'Thử đổi bộ lọc hoặc xóa điều kiện tìm kiếm.'
                : 'Giao dịch sẽ xuất hiện khi Cas gửi webhook sau khi liên kết ngân hàng.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {filteredItems.map((txn) => (
                <Card
                  key={txn.id}
                  className="cursor-pointer py-4 transition-colors hover:bg-muted/30"
                  onClick={() => openDetail(txn)}
                >
                  <CardContent className="text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        {formatTransactionTime(txn.transactionDate)}
                      </p>
                      <TransactionStatusBadge status={txn.status} />
                    </div>
                    <p className="mt-2 font-semibold text-primary">
                      {Number(txn.amount).toLocaleString('vi-VN')}đ
                    </p>
                    <p className="mt-1 text-muted-foreground">{txn.content ?? '—'}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {txn.senderAccount ?? 'Không rõ người gửi'}
                      </p>
                      <ConfidenceBadge score={txn.confidenceScore} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="hidden overflow-hidden py-0 md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="py-3">Thời gian</TableHead>
                    <TableHead className="py-3 text-right">Số tiền</TableHead>
                    <TableHead className="py-3">Nội dung</TableHead>
                    <TableHead className="py-3">Người gửi</TableHead>
                    <TableHead className="py-3 text-center">TK Nợ/Có</TableHead>
                    <TableHead className="py-3 text-center">Confidence</TableHead>
                    <TableHead className="py-3 text-right">Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((txn) => (
                    <TableRow
                      key={txn.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(txn)}
                    >
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTransactionTime(txn.transactionDate)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {Number(txn.amount).toLocaleString('vi-VN')}đ
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm">
                        {txn.content ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">{txn.senderAccount ?? '—'}</TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {txn.classification ? (
                          <span>
                            {txn.classification.debitAccount}/{txn.classification.creditAccount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <ConfidenceBadge
                          score={txn.classification?.confidenceScore ?? txn.confidenceScore}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <TransactionStatusBadge status={txn.status} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {data ? (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Hiển thị {filteredItems.length} / {data.total} giao dịch
                </p>
                {data.total > PAGE_SIZE ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Trước
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Trang {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Sau
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      <TransactionDetailSheet
        transaction={selectedTxn}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
