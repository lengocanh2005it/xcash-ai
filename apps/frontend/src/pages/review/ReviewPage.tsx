import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Pencil, SkipForward } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { formatDateVN } from '@/lib/dashboard-transactions';

interface ClassificationItem {
  id: string;
  debitAccount: string;
  creditAccount: string;
  confidenceScore: number;
  reason: string | null;
  transaction: {
    content: string | null;
    amount: string;
    transactionDate: string;
    grantId: string;
  };
}

interface ReviewQueueResponse {
  data: {
    items: ClassificationItem[];
    total: number;
    page: number;
    limit: number;
  };
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

const CONFIDENCE_OPTIONS: Array<{
  value: string;
  label: string;
  min?: number;
  max?: number;
}> = [
  { value: 'all', label: 'Tất cả độ tin cậy' },
  { value: 'low', label: 'Dưới 50%', max: 50 },
  { value: 'mid', label: '50% – 85%', min: 50, max: 85 },
];

function buildReviewQueueUrl(params: { page: number; search: string; confidence: string }): string {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(PAGE_SIZE),
  });
  if (params.search.trim()) {
    query.set('search', params.search.trim());
  }
  const band = CONFIDENCE_OPTIONS.find((o) => o.value === params.confidence);
  if (band?.min != null) {
    query.set('minConfidence', String(band.min));
  }
  if (band?.max != null) {
    query.set('maxConfidence', String(band.max));
  }
  return `/review/queue?${query.toString()}`;
}

async function fetchReviewQueue(url: string): Promise<ReviewQueueResponse['data']> {
  const res = await api.get(url);
  return res.data.data;
}

async function confirmReview(id: string) {
  await api.post(`/review/${id}/confirm`);
}

async function correctReview(id: string, debitAccount: string, creditAccount: string) {
  await api.post(`/review/${id}/correct`, { debitAccount, creditAccount });
}

async function skipReview(id: string) {
  await api.post(`/review/${id}/skip`);
}

function formatAmount(amount: string | number) {
  return Number(amount).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
}

function formatDate(dateStr: string) {
  return formatDateVN(dateStr);
}

const SWIPE_THRESHOLD = 80;

function SwipeableReviewCard({
  item,
  onConfirm,
  onSkip,
  onCorrect,
  disabled,
}: {
  item: ClassificationItem;
  onConfirm: () => void;
  onSkip: () => void;
  onCorrect: () => void;
  disabled: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragX(e.clientX - startX.current);
  };

  const handlePointerEnd = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX > SWIPE_THRESHOLD) {
      onConfirm();
    } else if (dragX < -SWIPE_THRESHOLD) {
      onSkip();
    }
    setDragX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-lg border">
      <div className="absolute inset-0 flex items-center justify-between px-4">
        <span className="flex items-center gap-1 text-sm font-medium text-green-600">
          <CheckCircle className="size-4" /> Xác nhận
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          Bỏ qua <SkipForward className="size-4" />
        </span>
      </div>
      <div
        className="relative touch-pan-y space-y-2 bg-background p-4"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform 0.2s',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {item.transaction.content ?? '—'}
          </p>
          <ConfidenceBadge score={item.confidenceScore} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {formatDate(item.transaction.transactionDate)}
          </span>
          <span className="font-mono">{formatAmount(item.transaction.amount)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-medium">
            {item.debitAccount} / {item.creditAccount}
          </span>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Sửa"
            aria-label="Sửa định khoản"
            onClick={onCorrect}
          >
            <Pencil className="size-4 text-blue-600" />
          </Button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Vuốt phải để xác nhận, vuốt trái để bỏ qua
        </p>
      </div>
    </div>
  );
}

const ACCOUNT_CODE_PATTERN = /^\d{3,4}$/;

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [confidence, setConfidence] = useState('all');
  const debouncedSearch = useDebouncedValue(
    searchText,
    SEARCH_DEBOUNCE_MS,
    useCallback(() => {
      setPage(1);
    }, []),
  );
  const [correctDialog, setCorrectDialog] = useState<ClassificationItem | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ClassificationItem | null>(null);
  const [skipTarget, setSkipTarget] = useState<ClassificationItem | null>(null);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');

  const queryUrl = buildReviewQueueUrl({ page, search: debouncedSearch, confidence });
  const hasActiveFilters = Boolean(debouncedSearch.trim() || confidence !== 'all');
  const isSearchPending = searchText !== debouncedSearch;

  const { data, isLoading } = useQuery({
    queryKey: ['review-queue', page, debouncedSearch, confidence],
    queryFn: () => fetchReviewQueue(queryUrl),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const clearFilters = () => {
    setSearchText('');
    setConfidence('all');
    setPage(1);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['review-queue'] });
    queryClient.invalidateQueries({ queryKey: ['review', 'count'] });
  };

  const confirmMutation = useMutation({
    mutationFn: confirmReview,
    onSuccess: () => {
      toast.success('Đã xác nhận định khoản');
      setConfirmTarget(null);
      invalidate();
    },
    onError: () => toast.error('Không thể xác nhận'),
  });

  const correctMutation = useMutation({
    mutationFn: ({ id, d, c }: { id: string; d: string; c: string }) => correctReview(id, d, c),
    onSuccess: () => {
      toast.success('Đã sửa và xác nhận định khoản');
      setCorrectDialog(null);
      invalidate();
    },
    onError: () => toast.error('Không thể sửa định khoản'),
  });

  const skipMutation = useMutation({
    mutationFn: skipReview,
    onSuccess: () => {
      toast.success('Đã bỏ qua');
      setSkipTarget(null);
      invalidate();
    },
    onError: () => toast.error('Không thể bỏ qua'),
  });

  const openCorrect = (item: ClassificationItem) => {
    setDebitAccount(item.debitAccount);
    setCreditAccount(item.creditAccount);
    setCorrectDialog(item);
  };

  return (
    <>
      <Header
        title="Human Review"
        description="Xem xét và xác nhận các định khoản AI chưa tự tin (dưới 85%)"
      />
      <div className="space-y-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>
              Hàng chờ review
              {data ? (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({data.total} mục)
                </span>
              ) : null}
            </CardTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="review-search">Tìm nội dung</Label>
                <Input
                  id="review-search"
                  placeholder="Tìm theo nội dung giao dịch..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-confidence">Độ tin cậy</Label>
                <Select
                  value={confidence}
                  onValueChange={(v) => {
                    setConfidence(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger id="review-confidence" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Đang lọc:</span>
                {debouncedSearch.trim() ? (
                  <Badge variant="secondary">"{debouncedSearch.trim()}"</Badge>
                ) : null}
                {confidence !== 'all' ? (
                  <Badge variant="secondary">
                    {CONFIDENCE_OPTIONS.find((o) => o.value === confidence)?.label}
                  </Badge>
                ) : null}
                {isSearchPending ? (
                  <span className="text-xs text-muted-foreground">Đang tìm...</span>
                ) : null}
                <Button variant="link" size="sm" className="h-auto px-1" onClick={clearFilters}>
                  Xóa bộ lọc
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : !data?.items.length ? (
              <EmptyState
                title={
                  hasActiveFilters
                    ? 'Không tìm thấy giao dịch phù hợp'
                    : 'Không có giao dịch cần review'
                }
                description={
                  hasActiveFilters
                    ? 'Thử đổi từ khóa hoặc bộ lọc độ tin cậy.'
                    : 'AI đã tự tin phân loại tất cả giao dịch. Làm tốt lắm!'
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
                <div className="space-y-3 lg:hidden">
                  {data.items.map((item) => (
                    <SwipeableReviewCard
                      key={item.id}
                      item={item}
                      onConfirm={() => setConfirmTarget(item)}
                      onSkip={() => setSkipTarget(item)}
                      onCorrect={() => openCorrect(item)}
                      disabled={confirmMutation.isPending || skipMutation.isPending}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-3 pr-4 font-medium">Ngày</th>
                        <th className="pb-3 pr-4 font-medium">Nội dung</th>
                        <th className="pb-3 pr-4 font-medium">Số tiền</th>
                        <th className="pb-3 pr-4 font-medium">TK Nợ</th>
                        <th className="pb-3 pr-4 font-medium">TK Có</th>
                        <th className="pb-3 pr-4 font-medium">Độ tin cậy</th>
                        <th className="pb-3 font-medium">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.items.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(item.transaction.transactionDate)}
                          </td>
                          <td
                            className="max-w-[250px] truncate py-3 pr-4"
                            title={item.transaction.content ?? ''}
                          >
                            {item.transaction.content ?? '—'}
                          </td>
                          <td className="py-3 pr-4 font-mono">
                            {formatAmount(item.transaction.amount)}
                          </td>
                          <td className="py-3 pr-4 font-mono font-medium">{item.debitAccount}</td>
                          <td className="py-3 pr-4 font-mono font-medium">{item.creditAccount}</td>
                          <td className="py-3 pr-4">
                            <ConfidenceBadge score={item.confidenceScore} />
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Xác nhận"
                                aria-label="Xác nhận định khoản"
                                onClick={() => setConfirmTarget(item)}
                                disabled={confirmMutation.isPending}
                              >
                                <CheckCircle className="size-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Sửa"
                                aria-label="Sửa định khoản"
                                onClick={() => openCorrect(item)}
                              >
                                <Pencil className="size-4 text-blue-600" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Bỏ qua"
                                aria-label="Bỏ qua giao dịch"
                                onClick={() => setSkipTarget(item)}
                                disabled={skipMutation.isPending}
                              >
                                <SkipForward className="size-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data ? (
                  <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
                    <p className="text-sm text-muted-foreground">
                      Hiển thị {data.items.length} / {data.total} mục
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
          </CardContent>
        </Card>

        <Dialog open={!!correctDialog} onOpenChange={(open) => !open && setCorrectDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sửa định khoản</DialogTitle>
            </DialogHeader>
            {correctDialog ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{correctDialog.transaction.content}</p>
                {correctDialog.reason ? (
                  <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    AI: {correctDialog.reason}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>TK Nợ</Label>
                    <Input
                      value={debitAccount}
                      onChange={(e) => setDebitAccount(e.target.value)}
                      placeholder="vd: 112"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TK Có</Label>
                    <Input
                      value={creditAccount}
                      onChange={(e) => setCreditAccount(e.target.value)}
                      placeholder="vd: 511"
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setCorrectDialog(null)}>
                Huỷ
              </Button>
              <Button
                onClick={() => {
                  if (!correctDialog) return;
                  if (
                    !ACCOUNT_CODE_PATTERN.test(debitAccount) ||
                    !ACCOUNT_CODE_PATTERN.test(creditAccount)
                  ) {
                    toast.error('Mã tài khoản phải có 3–4 chữ số');
                    return;
                  }
                  correctMutation.mutate({
                    id: correctDialog.id,
                    d: debitAccount,
                    c: creditAccount,
                  });
                }}
                disabled={correctMutation.isPending || !debitAccount || !creditAccount}
              >
                Xác nhận sửa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={confirmTarget !== null}
          onOpenChange={(open) => !open && setConfirmTarget(null)}
          title="Xác nhận định khoản này?"
          description={
            confirmTarget
              ? `Định khoản ${confirmTarget.debitAccount}/${confirmTarget.creditAccount} cho giao dịch "${confirmTarget.transaction.content ?? 'Không có nội dung'}" sẽ được ghi nhận.`
              : ''
          }
          confirmLabel="Xác nhận"
          loading={confirmMutation.isPending}
          onConfirm={() => {
            if (confirmTarget) confirmMutation.mutate(confirmTarget.id);
          }}
        />

        <ConfirmDialog
          open={skipTarget !== null}
          onOpenChange={(open) => !open && setSkipTarget(null)}
          title="Bỏ qua giao dịch này?"
          description={
            skipTarget
              ? `Giao dịch "${skipTarget.transaction.content ?? 'Không có nội dung'}" sẽ được đánh dấu bỏ qua và không định khoản.`
              : ''
          }
          confirmLabel="Bỏ qua"
          variant="destructive"
          loading={skipMutation.isPending}
          onConfirm={() => {
            if (skipTarget) skipMutation.mutate(skipTarget.id);
          }}
        />
      </div>
    </>
  );
}
