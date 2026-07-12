import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CONFIDENCE_OPTIONS } from '@/hooks/useReviewQueue';

interface ReviewFiltersProps {
  search: string;
  confidence: string;
  debouncedSearch: string;
  debouncedConfidence: string;
  isSearchPending: boolean;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onConfidenceChange: (value: string) => void;
  onClear: () => void;
}

export function ReviewFilters({
  search,
  confidence,
  debouncedSearch,
  debouncedConfidence,
  isSearchPending,
  hasActiveFilters,
  onSearchChange,
  onConfidenceChange,
  onClear,
}: ReviewFiltersProps) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="review-search">Tìm nội dung</Label>
          <Input
            id="review-search"
            placeholder="Tìm theo nội dung giao dịch..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-confidence">Độ tin cậy</Label>
          <Select value={confidence} onValueChange={onConfidenceChange}>
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
          {debouncedConfidence !== 'all' ? (
            <Badge variant="secondary">
              {CONFIDENCE_OPTIONS.find((o) => o.value === debouncedConfidence)?.label}
            </Badge>
          ) : null}
          {isSearchPending ? (
            <span className="text-xs text-muted-foreground">Đang tìm...</span>
          ) : null}
          <Button variant="link" size="sm" className="h-auto px-1" onClick={onClear}>
            Xóa bộ lọc
          </Button>
        </div>
      ) : null}
    </>
  );
}
