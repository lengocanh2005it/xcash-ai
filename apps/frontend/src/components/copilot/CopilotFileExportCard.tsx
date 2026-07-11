import type { CopilotFileExportData } from '@xcash/shared-types';
import { FileDown, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function CopilotFileExportCard({ fileExport }: { fileExport: CopilotFileExportData }) {
  const [downloading, setDownloading] = useState(false);
  const Icon = fileExport.format === 'excel' ? FileSpreadsheet : FileText;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.get(`/reports/copilot-export/${fileExport.exportId}`, {
        params: {
          format: fileExport.format,
          fromDate: fileExport.fromDate,
          toDate: fileExport.toDate,
        },
        responseType: 'blob',
      });

      const blob = res.data as Blob;
      if (blob.type.includes('json')) {
        const message = JSON.parse(await blob.text()) as { error?: { message?: string } };
        throw new Error(message.error?.message ?? 'Không thể tải file');
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileExport.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã tải xuống báo cáo');
    } catch {
      toast.error('Không thể tải file, vui lòng thử lại');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mt-2 flex max-w-sm items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-xs">{fileExport.fileName}</span>
      <Button size="sm" variant="secondary" disabled={downloading} onClick={handleDownload}>
        {downloading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <FileDown className="size-3.5" />
        )}
        Tải về
      </Button>
    </div>
  );
}
