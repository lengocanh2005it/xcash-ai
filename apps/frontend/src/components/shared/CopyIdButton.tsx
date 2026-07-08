import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  id: string | null | undefined;
  /** Số ký tự hiển thị rút gọn, mặc định 8 */
  previewLength?: number;
}

export function CopyIdButton({ id, previewLength = 8 }: Props) {
  const [copied, setCopied] = useState(false);

  if (!id) return <span className="text-xs text-muted-foreground">—</span>;

  const handleCopy = () => {
    void navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-1 py-0.5 transition-colors"
          aria-label="Sao chép mã giao dịch"
        >
          <span>{id.slice(0, previewLength)}</span>
          {copied ? (
            <Check className="size-3 text-green-500" />
          ) : (
            <Copy className="size-3 shrink-0" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent className="font-mono text-xs">{id}</TooltipContent>
    </Tooltip>
  );
}
