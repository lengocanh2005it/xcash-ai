import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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

interface ReportPeriodSelectorProps {
  year: number;
  month: number;
  yearOptions: number[];
  canExport: boolean;
  requiredPlanLabel: string;
  isLoading: boolean;
  onPeriodChange: (year: number, month: number) => void;
  onExport: () => void;
}

export function ReportPeriodSelector({
  year,
  month,
  yearOptions,
  canExport,
  requiredPlanLabel,
  isLoading,
  onPeriodChange,
  onExport,
}: ReportPeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <Select value={String(month)} onValueChange={(v) => onPeriodChange(year, Number(v))}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={m} value={String(i + 1)}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onPeriodChange(Number(v), month)}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canExport ? (
        <Button onClick={onExport} disabled={isLoading}>
          <Download className="mr-2 size-4" />
          Xuất Excel
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">
              <Button disabled className="pointer-events-none">
                <Download className="mr-2 size-4" />
                Xuất Excel
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Nâng cấp lên gói {requiredPlanLabel} để mở khóa tính năng Xuất Excel
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
