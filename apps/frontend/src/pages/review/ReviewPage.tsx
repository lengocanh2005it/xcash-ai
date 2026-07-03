import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Pencil, SkipForward, XCircle } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Header } from '@/components/layout/Header';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/TableSkeleton';
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
import { api } from '@/lib/api';

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

async function fetchReviewQueue(page: number): Promise<ReviewQueueResponse['data']> {
  const res = await api.get(`/review/queue?page=${page}&limit=20`);
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
  return new Date(dateStr).toLocaleDateString('vi-VN');
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
          <Button size="icon-sm" variant="ghost" title="Sửa" onClick={onCorrect}>
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

export default function ReviewPage() {
  const queryClient = useQueryClient();
  const [page] = useState(1);
  const [correctDialog, setCorrectDialog] = useState<ClassificationItem | null>(null);
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['review-queue', page],
    queryFn: () => fetchReviewQueue(page),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['review-queue'] });

  const confirmMutation = useMutation({
    mutationFn: confirmReview,
    onSuccess: () => {
      toast.success('Đã xác nhận định khoản');
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
          <CardHeader>
            <CardTitle>
              Hàng chờ review
              {data ? (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({data.total} mục)
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={5} columns={6} />
            ) : !data?.items.length ? (
              <EmptyState
                title="Không có giao dịch cần review"
                description="AI đã tự tin phân loại tất cả giao dịch. Làm tốt lắm!"
              />
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {data.items.map((item) => (
                    <SwipeableReviewCard
                      key={item.id}
                      item={item}
                      onConfirm={() => confirmMutation.mutate(item.id)}
                      onSkip={() => skipMutation.mutate(item.id)}
                      onCorrect={() => openCorrect(item)}
                      disabled={confirmMutation.isPending || skipMutation.isPending}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
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
                                onClick={() => confirmMutation.mutate(item.id)}
                                disabled={confirmMutation.isPending}
                              >
                                <CheckCircle className="size-4 text-green-600" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Sửa"
                                onClick={() => openCorrect(item)}
                              >
                                <XCircle className="size-4 text-blue-600" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                title="Bỏ qua"
                                onClick={() => skipMutation.mutate(item.id)}
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
                onClick={() =>
                  correctDialog &&
                  correctMutation.mutate({
                    id: correctDialog.id,
                    d: debitAccount,
                    c: creditAccount,
                  })
                }
                disabled={correctMutation.isPending || !debitAccount || !creditAccount}
              >
                Xác nhận sửa
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
