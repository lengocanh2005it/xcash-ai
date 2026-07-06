import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { formatVND } from '@/lib/format-vnd';

interface RowError {
  row: number;
  column?: string;
  value?: string;
  message: string;
}

interface RowWarning {
  row: number;
  message: string;
}

interface ValidateResult {
  valid: boolean;
  totalRows?: number;
  errorCount?: number;
  errors?: RowError[];
  warnings?: RowWarning[];
  quotaImpact?: {
    willUse: number;
    remaining: number;
    willExceedQuota: boolean;
  };
  preview?: Array<{
    row: number;
    date: string;
    description: string;
    amount: number;
    direction: 'in' | 'out';
  }>;
}

interface ImportResult {
  batchId: string;
  imported: number;
  skipped: number;
  skippedReasons?: Array<{ row: number; reason: string }>;
  quotaWarning?: string;
}

type Step = 'upload' | 'preview' | 'result';

interface ImportTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: ImportResult) => void;
}

async function downloadTemplate() {
  const response = await api.get('/transactions/import/template', { responseType: 'blob' });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template-nhap-giao-dich.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportTransactionsDialog({
  open,
  onOpenChange,
  onImported,
}: ImportTransactionsDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validateResult, setValidateResult] = useState<ValidateResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post<{ success: boolean; data: ValidateResult }>(
        '/transactions/import/validate',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data.data;
    },
    onSuccess: (result) => {
      setValidateResult(result);
      setStep('preview');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Không thể đọc file — vui lòng kiểm tra lại'));
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post<{ success: boolean; data: ImportResult }>(
        '/transactions/import',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return response.data.data;
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['review'] });
      onImported?.(result);
      toast.success(
        `Đã import ${result.imported.toLocaleString()} giao dịch — đang lọc theo Import Excel`,
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Import thất bại — vui lòng thử lại'));
    },
  });

  function reset() {
    setStep('upload');
    setSelectedFile(null);
    setValidateResult(null);
    setImportResult(null);
    validateMutation.reset();
    importMutation.reset();
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(reset, 300);
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      toast.error('Chỉ hỗ trợ file Excel (.xlsx)');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File quá lớn — tối đa 2MB');
      return;
    }
    setSelectedFile(file);
    validateMutation.mutate(file);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = '';
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập giao dịch từ Excel</DialogTitle>
          <DialogDescription>
            Upload file Excel theo mẫu để nhập giao dịch tiền mặt hoặc ngân hàng chưa liên kết
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {(['upload', 'preview', 'result'] as Step[]).map((s, i) => {
            const labels = ['1. Chọn file', '2. Kiểm tra', '3. Kết quả'];
            const isActive = step === s;
            const isDone =
              (s === 'upload' && (step === 'preview' || step === 'result')) ||
              (s === 'preview' && step === 'result');
            return (
              <span
                key={s}
                className={`flex items-center gap-1 ${isActive ? 'font-semibold text-primary' : isDone ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {i > 0 && <span className="text-muted-foreground">›</span>}
                {labels[i]}
              </span>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <section
              aria-label="Vùng kéo thả file"
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {validateMutation.isPending ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Đang đọc và kiểm tra file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <FileSpreadsheet className="size-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Kéo thả file hoặc click chọn file</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Chỉ hỗ trợ .xlsx, tối đa 2MB, tối đa 500 dòng
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={validateMutation.isPending}
                  >
                    <Upload className="mr-2 size-4" />
                    Chọn file Excel
                  </Button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={handleInputChange}
              />
            </section>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
              <p className="font-medium">Lưu ý quan trọng</p>
              <p className="mt-1">
                Không nhập các giao dịch đã có trong sao kê ngân hàng liên kết để tránh tính trùng.
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() =>
                  downloadTemplate().catch(() => toast.error('Không thể tải template'))
                }
              >
                Tải file Excel mẫu
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Preview / Errors */}
        {step === 'preview' && validateResult && (
          <div className="space-y-4">
            {selectedFile && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}

            {!validateResult.valid ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="size-5" />
                  <p className="font-medium">
                    File có {validateResult.errorCount} lỗi — vui lòng sửa và upload lại
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Dòng</th>
                        <th className="px-3 py-2 text-left font-medium">Cột</th>
                        <th className="px-3 py-2 text-left font-medium">Giá trị</th>
                        <th className="px-3 py-2 text-left font-medium">Lỗi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validateResult.errors?.map((err) => (
                        <tr key={`${err.row}-${err.column ?? 'r'}`} className="border-t">
                          <td className="px-3 py-2 font-mono">{err.row}</td>
                          <td className="px-3 py-2 text-muted-foreground">{err.column ?? '—'}</td>
                          <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs">
                            {err.value ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-destructive">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" onClick={reset} className="w-full">
                  Chọn file khác
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quota */}
                {validateResult.quotaImpact && (
                  <div
                    className={`rounded-lg border p-3 text-sm ${validateResult.quotaImpact.willExceedQuota ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400' : 'border-border bg-muted/30'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Sẽ dùng {validateResult.quotaImpact.willUse} slot quota</span>
                      <span className="text-muted-foreground">
                        Còn lại: {validateResult.quotaImpact.remaining}
                      </span>
                    </div>
                    {validateResult.quotaImpact.willExceedQuota && (
                      <p className="mt-1 font-medium">
                        Vượt quota — phí vượt sẽ tính vào chu kỳ hiện tại
                      </p>
                    )}
                    {validateResult.quotaImpact.remaining > 0 && (
                      <Progress
                        className="mt-2 h-1.5"
                        value={Math.min(
                          100,
                          (validateResult.quotaImpact.willUse /
                            (validateResult.quotaImpact.remaining +
                              validateResult.quotaImpact.willUse)) *
                            100,
                        )}
                      />
                    )}
                  </div>
                )}

                {/* Warnings */}
                {validateResult.warnings && validateResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                    <p className="font-medium">
                      {validateResult.warnings.length} cảnh báo (không ảnh hưởng import)
                    </p>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5">
                      {validateResult.warnings.slice(0, 5).map((w) => (
                        <li key={w.row}>
                          Dòng {w.row}: {w.message}
                        </li>
                      ))}
                      {validateResult.warnings.length > 5 && (
                        <li>...và {validateResult.warnings.length - 5} cảnh báo khác</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Preview table */}
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Xem trước ({validateResult.totalRows} dòng, hiện 5 dòng đầu)
                  </p>
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Ngày</th>
                          <th className="px-3 py-2 text-left font-medium">Mô tả</th>
                          <th className="px-3 py-2 text-right font-medium">Số tiền</th>
                          <th className="px-3 py-2 text-center font-medium">Loại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validateResult.preview?.map((row) => (
                          <tr key={row.row} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{row.date}</td>
                            <td className="max-w-[200px] truncate px-3 py-2">{row.description}</td>
                            <td className="px-3 py-2 text-right font-semibold">
                              {formatVND(row.amount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                variant="outline"
                                className={
                                  row.direction === 'in'
                                    ? 'border-primary/30 bg-primary/10 text-primary'
                                    : 'border-destructive/30 bg-destructive/10 text-destructive'
                                }
                              >
                                {row.direction === 'in' ? 'Thu' : 'Chi'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} disabled={importMutation.isPending}>
                    Chọn file khác
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => selectedFile && importMutation.mutate(selectedFile)}
                    disabled={importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Đang import...
                      </>
                    ) : (
                      `Import ${validateResult.totalRows} giao dịch`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Result */}
        {step === 'result' && importResult && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="size-12 text-primary" />
              <div>
                <p className="text-xl font-bold">Import thành công!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Đã nhập{' '}
                  <span className="font-semibold text-foreground">{importResult.imported}</span>{' '}
                  giao dịch
                  {importResult.skipped > 0 ? (
                    <>
                      , bỏ qua{' '}
                      <span className="font-semibold text-foreground">{importResult.skipped}</span>{' '}
                      trùng lặp
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            {importResult.quotaWarning && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
                {importResult.quotaWarning}
              </div>
            )}

            {importResult.skippedReasons && importResult.skippedReasons.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Dòng bỏ qua</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {importResult.skippedReasons.slice(0, 5).map((r) => (
                    <li key={r.row}>
                      Dòng {r.row}: {r.reason}
                    </li>
                  ))}
                  {importResult.skippedReasons.length > 5 && (
                    <li>...và {importResult.skippedReasons.length - 5} dòng khác</li>
                  )}
                </ul>
              </div>
            )}

            {importResult.imported > 0 && (
              <p className="text-sm text-muted-foreground">
                AI đang phân loại giao dịch — kết quả sẽ hiển thị trong danh sách trong vài giây.
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} className="flex-1">
                Import thêm
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Đóng
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
