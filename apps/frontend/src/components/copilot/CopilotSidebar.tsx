import type { CopilotConversationSummary } from '@xcash/shared-types';
import { Loader2, MessageSquarePlus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CopilotQuotaSummary } from '@/components/copilot/CopilotQuotaSummary';
import { Button } from '@/components/ui/button';
import { useCopilotConversations } from '@/hooks/useCopilotConversations';
import { cn } from '@/lib/utils';

interface Props {
  userId?: string;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRequestDelete: (item: CopilotConversationSummary) => void;
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function groupByDate(items: CopilotConversationSummary[]) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: { label: string; items: CopilotConversationSummary[] }[] = [];
  const buckets: Record<string, CopilotConversationSummary[]> = {
    'Hôm nay': [],
    'Hôm qua': [],
    '7 ngày qua': [],
    'Tháng này': [],
  };
  const olderBuckets: Map<string, CopilotConversationSummary[]> = new Map();

  for (const item of items) {
    const d = new Date(item.updatedAt);
    if (isSameDay(d, now)) {
      buckets['Hôm nay'].push(item);
    } else if (isSameDay(d, yesterday)) {
      buckets['Hôm qua'].push(item);
    } else if (d >= sevenDaysAgo) {
      buckets['7 ngày qua'].push(item);
    } else if (d >= monthStart) {
      buckets['Tháng này'].push(item);
    } else {
      const key = toDateKey(d);
      const existing = olderBuckets.get(key) ?? [];
      existing.push(item);
      olderBuckets.set(key, existing);
    }
  }

  for (const [label, list] of Object.entries(buckets)) {
    if (list.length > 0) groups.push({ label, items: list });
  }
  for (const [key, list] of olderBuckets.entries()) {
    const d = new Date(`${key}-01`);
    groups.push({ label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`, items: list });
  }

  return groups;
}

function ConversationItem({
  item,
  isActive,
  onSelect,
  onRename,
  onDelete,
}: {
  item: CopilotConversationSummary;
  isActive: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(item.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== item.title) onRename(trimmed);
    setRenaming(false);
  };

  return (
    <div
      className={cn(
        'group relative flex items-center rounded-lg text-sm transition-colors',
        isActive
          ? 'bg-primary/10 font-medium text-primary ring-1 ring-primary/15'
          : 'text-foreground/80 hover:bg-primary/5 hover:text-primary',
      )}
    >
      {renaming ? (
        <div className="flex-1 px-3 py-2">
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="w-full bg-transparent text-sm outline-none border-b border-primary"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 truncate text-left px-3 py-2 text-foreground/80"
        >
          {item.title}
        </button>
      )}

      <div className="relative shrink-0 pr-1" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className={cn(
            'flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-opacity',
            menuOpen || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
          aria-label="Tùy chọn"
        >
          <MoreHorizontal className="size-3.5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 min-w-[140px] rounded-lg border border-border bg-popover shadow-md py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setRenaming(true);
                setRenameValue(item.title);
              }}
            >
              <Pencil className="size-3.5 text-muted-foreground" />
              Đổi tên
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                requestAnimationFrame(() => onDelete());
              }}
            >
              <Trash2 className="size-3.5" />
              Xóa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CopilotSidebar({
  userId,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRequestDelete,
}: Props) {
  const { items, renameConversation, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCopilotConversations(userId);
  const [needsManualLoad, setNeedsManualLoad] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const groups = groupByDate(items);

  const updateManualLoadState = useCallback(() => {
    const el = listScrollRef.current;
    if (!el) return;
    setNeedsManualLoad(hasNextPage && el.scrollHeight <= el.clientHeight + 2);
  }, [hasNextPage]);

  useEffect(() => {
    updateManualLoadState();
  }, [updateManualLoadState, items.length]);

  useEffect(() => {
    const el = listScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateManualLoadState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateManualLoadState]);

  // Chỉ gọi API trang tiếp theo khi user scroll gần cuối — không prefetch full lịch sử lúc mount.
  useEffect(() => {
    const el = listScrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;

    const onScroll = () => {
      if (loadingMoreRef.current || isFetchingNextPage) return;
      if (el.scrollTop + el.clientHeight < el.scrollHeight - 64) return;
      loadingMoreRef.current = true;
      void fetchNextPage().finally(() => {
        loadingMoreRef.current = false;
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* New chat button */}
      <div className="shrink-0 p-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-sidebar-border/80 bg-background shadow-none hover:bg-primary/5 hover:text-primary"
          onClick={onNewChat}
        >
          <MessageSquarePlus className="size-4" />
          Cuộc trò chuyện mới
        </Button>
      </div>

      {/* Conversations list */}
      <div
        ref={listScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {groups.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">
            Chưa có cuộc chat nào
          </p>
        )}
        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            {group.items.map((item) => (
              <ConversationItem
                key={item.id}
                item={item}
                isActive={item.id === activeConversationId}
                onSelect={() => onSelectConversation(item.id)}
                onRename={(title) => renameConversation(item.id, title)}
                onDelete={() => onRequestDelete(item)}
              />
            ))}
          </div>
        ))}
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-label="Đang tải thêm"
            />
          </div>
        )}
        {needsManualLoad && !isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={() => void fetchNextPage()}
            >
              Tải thêm
            </Button>
          </div>
        )}
      </div>

      <div className="shrink-0">
        <CopilotQuotaSummary variant="sidebar" />
      </div>
    </div>
  );
}
