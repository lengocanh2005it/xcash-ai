import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Bot, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type ElementType, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';

const CALL_TYPE_LABELS: Record<string, string> = {
  classify: 'Định khoản',
  copilot: 'Copilot',
  embedding: 'Embedding',
  title_gen: 'Tiêu đề',
};

const CALL_TYPE_COLORS: Record<string, string> = {
  classify: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  copilot: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  embedding: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  title_gen: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

interface BreakdownItem {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  callCount: number;
}

interface AiCostRow {
  tenantId: string;
  tenantName: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  breakdown: Record<string, BreakdownItem>;
}

interface AiCostsResponse {
  items: AiCostRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  grandTotalCostUsd: number;
}

interface DetailLog {
  id: string;
  callType: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  transactionId: string | null;
  conversationId: string | null;
  createdAt: string;
}

interface DetailResponse {
  items: DetailLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function getDefaultFromDate() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string;
  isLoading?: boolean;
}

function StatCard({ icon: Icon, label, value, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {isLoading ? (
            <Skeleton className="mt-1 h-5 w-24" />
          ) : (
            <p className="truncate text-base font-semibold">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartnerAiCostsPage() {
  const [fromDate, setFromDate] = useState(getDefaultFromDate);
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const [detailTenant, setDetailTenant] = useState<AiCostRow | null>(null);
  const [detailCallType, setDetailCallType] = useState<string>('all');
  const [detailPage, setDetailPage] = useState(1);

  const { data, isLoading } = useQuery<AiCostsResponse>({
    queryKey: ['partner', 'ai-costs', fromDate, toDate, page],
    queryFn: () =>
      api
        .get<{ data: AiCostsResponse }>('/partner/ai-costs', {
          params: {
            ...(fromDate ? { fromDate } : {}),
            ...(toDate ? { toDate } : {}),
            page,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
    placeholderData: keepPreviousData,
  });

  const { data: detail, isLoading: loadingDetail } = useQuery<DetailResponse>({
    queryKey: ['partner', 'ai-cost-detail', detailTenant?.tenantId, detailCallType, detailPage],
    queryFn: () =>
      api
        .get<{ data: DetailResponse }>('/partner/ai-costs/detail', {
          params: {
            tenantId: detailTenant!.tenantId,
            ...(detailCallType !== 'all' ? { callType: detailCallType } : {}),
            ...(fromDate ? { fromDate } : {}),
            ...(toDate ? { toDate } : {}),
            page: detailPage,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
    enabled: !!detailTenant,
    placeholderData: keepPreviousData,
  });

  const handleDateChange = (field: 'from' | 'to', value: string) => {
    setPage(1);
    if (field === 'from') setFromDate(value);
    else setToDate(value);
  };

  const openDetail = (row: AiCostRow) => {
    setDetailTenant(row);
    setDetailCallType('all');
    setDetailPage(1);
  };

  const closeDetail = () => setDetailTenant(null);

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="flex flex-col">
      <Header title="Chi phí AI" description="Theo dõi chi phí OpenAI API theo từng doanh nghiệp" />

      <div className="space-y-4 p-4 lg:p-6">
        {/* Summary stat */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Bot}
            label="Tổng chi phí AI (kỳ đã chọn)"
            value={`$${(data?.grandTotalCostUsd ?? 0).toFixed(6)}`}
            isLoading={isLoading}
          />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Lọc theo kỳ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Từ</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => handleDateChange('from', e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Đến</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => handleDateChange('to', e.target.value)}
                  className="w-40"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <TableSkeleton columns={5} rows={8} />
            ) : !data?.items.length ? (
              <EmptyState
                icon={Bot}
                title="Không có dữ liệu"
                description="Chưa có giao dịch AI nào trong kỳ đã chọn."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doanh nghiệp</TableHead>
                    <TableHead className="text-right">Tokens đầu vào</TableHead>
                    <TableHead className="text-right">Tokens đầu ra</TableHead>
                    <TableHead>Phân loại cuộc gọi</TableHead>
                    <TableHead className="text-right">Chi phí (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow
                      key={row.tenantId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openDetail(row)}
                    >
                      <TableCell className="font-medium">{row.tenantName}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {row.totalTokensIn.toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {row.totalTokensOut.toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(row.breakdown).map(([ct, b]) => (
                            <Badge
                              key={ct}
                              variant="outline"
                              className={`text-[11px] ${CALL_TYPE_COLORS[ct] ?? ''}`}
                            >
                              {CALL_TYPE_LABELS[ct] ?? ct} ×{b.callCount}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ${row.totalCostUsd.toFixed(6)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <span className="text-sm text-muted-foreground">
              Trang {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!detailTenant} onOpenChange={(open) => !open && closeDetail()}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle className="text-base">{detailTenant?.tenantName}</SheetTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Chi tiết cuộc gọi AI · ${detailTenant?.totalCostUsd.toFixed(6)} tổng
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={closeDetail} aria-label="Đóng">
                <X className="size-4" />
              </Button>
            </div>
            <div className="mt-3">
              <Select
                value={detailCallType}
                onValueChange={(v) => {
                  setDetailCallType(v);
                  setDetailPage(1);
                }}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả loại</SelectItem>
                  {Object.entries(CALL_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loadingDetail ? (
              <TableSkeleton columns={7} rows={10} />
            ) : !detail?.items.length ? (
              <EmptyState
                icon={Bot}
                title="Không có dữ liệu"
                description="Không có cuộc gọi AI nào cho bộ lọc này."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Chi phí</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead>Thời gian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${CALL_TYPE_COLORS[log.callType] ?? ''}`}
                        >
                          {CALL_TYPE_LABELS[log.callType] ?? log.callType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.model}</TableCell>
                      <TableCell className="text-right text-xs">
                        {log.tokensIn.toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {log.tokensOut.toLocaleString('vi-VN')}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">
                        ${log.costUsd.toFixed(6)}
                      </TableCell>
                      <TableCell className="max-w-[140px] text-xs text-muted-foreground">
                        {log.transactionId ? (
                          <span title={log.transactionId}>
                            txn:{log.transactionId.slice(0, 8)}…
                          </span>
                        ) : log.conversationId ? (
                          <span title={log.conversationId}>
                            conv:{log.conversationId.slice(0, 8)}…
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {(detail?.totalPages ?? 0) > 1 && (
            <div className="flex items-center justify-end gap-2 border-t px-6 py-3">
              <span className="text-sm text-muted-foreground">
                Trang {detailPage} / {detail!.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                disabled={detailPage <= 1}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setDetailPage((p) => Math.min(detail!.totalPages, p + 1))}
                disabled={detailPage >= detail!.totalPages}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
