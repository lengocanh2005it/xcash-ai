import { Search } from 'lucide-react';
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

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả loại TK' },
  { value: 'asset', label: 'Tài sản' },
  { value: 'liability', label: 'Nợ phải trả' },
  { value: 'equity', label: 'Vốn chủ sở hữu' },
  { value: 'revenue', label: 'Doanh thu' },
  { value: 'expense', label: 'Chi phí' },
];

interface AccountFiltersProps {
  searchText: string;
  accountTypeFilter: string;
  debouncedSearch: string;
  hasAccountFilters: boolean;
  isSearchPending: boolean;
  onSearchChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onClear: () => void;
}

export function AccountFilters({
  searchText,
  accountTypeFilter,
  debouncedSearch,
  hasAccountFilters,
  isSearchPending,
  onSearchChange,
  onTypeChange,
  onClear,
}: AccountFiltersProps) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="account-search">Tìm tài khoản</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="account-search"
              placeholder="Mã hoặc tên tài khoản..."
              value={searchText}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-type">Loại tài khoản</Label>
          <Select value={accountTypeFilter} onValueChange={onTypeChange}>
            <SelectTrigger id="account-type" className="w-full">
              <SelectValue placeholder="Tất cả loại TK" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {hasAccountFilters || isSearchPending ? (
        <div className="flex flex-wrap items-center gap-2">
          {debouncedSearch.trim() ? (
            <Badge variant="secondary">"{debouncedSearch.trim()}"</Badge>
          ) : null}
          {accountTypeFilter !== 'all' ? (
            <Badge variant="secondary">
              {ACCOUNT_TYPE_OPTIONS.find((o) => o.value === accountTypeFilter)?.label}
            </Badge>
          ) : null}
          {isSearchPending ? (
            <span className="text-xs text-muted-foreground">Đang tìm...</span>
          ) : null}
          {hasAccountFilters ? (
            <Button variant="link" size="sm" className="h-auto px-1" onClick={onClear}>
              Xóa bộ lọc
            </Button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
