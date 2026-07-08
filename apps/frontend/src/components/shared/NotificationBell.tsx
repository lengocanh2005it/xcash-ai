import type { AppNotification } from '@xcash/shared-types';
import { Bell, CheckCheck, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useDeleteAllNotifications,
  useDeleteNotification,
  useDeleteNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/lib/date';
import { cn } from '@/lib/utils';

const DROPDOWN_WIDTH = 352; // 22rem
const VIEWPORT_PADDING = 16;

interface NotificationBellProps {
  className?: string;
  align?: 'left' | 'right';
}

function getDropdownPosition(rect: DOMRect, align: 'left' | 'right') {
  const width = Math.min(window.innerWidth - VIEWPORT_PADDING * 2, DROPDOWN_WIDTH);
  const preferredLeft = align === 'left' ? rect.left : rect.right - width;
  const left = Math.max(
    VIEWPORT_PADDING,
    Math.min(preferredLeft, window.innerWidth - width - VIEWPORT_PADDING),
  );

  return {
    top: rect.bottom + 8,
    left,
    width,
  };
}

export function NotificationBell({ className, align = 'right' }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0, width: DROPDOWN_WIDTH });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteOne = useDeleteNotification();
  const deleteMany = useDeleteNotifications();
  const deleteAll = useDeleteAllNotifications();

  const unreadCount = data?.unreadCount ?? 0;
  const items = data?.items ?? [];
  const isMutating = deleteOne.isPending || deleteMany.isPending || deleteAll.isPending;
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  useEffect(() => {
    if (!open) {
      setSelectMode(false);
      setSelectedIds(new Set());
      return;
    }

    const reposition = () => {
      if (!triggerRef.current) {
        return;
      }
      setDropdownStyle(getDropdownPosition(triggerRef.current.getBoundingClientRect(), align));
    };

    reposition();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, align]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((item) => item.id)),
    );
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (selectMode) {
      toggleSelected(notification.id);
      return;
    }

    if (!notification.readAt) {
      await markRead.mutateAsync(notification.id);
    }

    setOpen(false);

    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }
    await markAllRead.mutateAsync();
  };

  const handleDeleteOne = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    await deleteOne.mutateAsync(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      return;
    }
    await deleteMany.mutateAsync(Array.from(selectedIds));
    exitSelectMode();
  };

  const handleDeleteAll = async () => {
    if (items.length === 0) {
      return;
    }
    await deleteAll.mutateAsync();
    setConfirmDeleteAllOpen(false);
    exitSelectMode();
  };

  const dropdown = open
    ? createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[100] overflow-hidden rounded-xl border border-border bg-background shadow-lg"
          style={{
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            width: dropdownStyle.width,
          }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Thông báo</p>
            {items.length > 0 ? (
              selectMode ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                  onClick={exitSelectMode}
                >
                  <X className="size-3.5" />
                  Hủy
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => setSelectMode(true)}
                >
                  Chọn
                </Button>
              )
            ) : null}
          </div>

          {items.length > 0 ? (
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
              {selectMode ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Chọn tất cả"
                    />
                    <button type="button" className="cursor-pointer" onClick={toggleSelectAll}>
                      Đã chọn {selectedIds.size}/{items.length}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={selectedIds.size === 0 || isMutating}
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="size-3.5" />
                    Xóa ({selectedIds.size})
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                    disabled={unreadCount === 0 || markAllRead.isPending}
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="size-3.5" />
                    Đọc tất cả
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={isMutating}
                    onClick={() => setConfirmDeleteAllOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Xóa tất cả
                  </Button>
                </>
              )}
            </div>
          ) : null}

          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Đang tải...</p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Chưa có thông báo nào</p>
                <p className="text-xs text-muted-foreground/70">Thông báo mới sẽ xuất hiện ở đây</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((notification) => (
                  <li key={notification.id} className="group relative">
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                        !notification.readAt && 'bg-primary/5',
                        selectMode && selectedIds.has(notification.id) && 'bg-primary/10',
                      )}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {selectMode ? (
                        <Checkbox
                          className="mt-0.5"
                          checked={selectedIds.has(notification.id)}
                          onCheckedChange={() => toggleSelected(notification.id)}
                          aria-label="Chọn thông báo"
                        />
                      ) : !notification.readAt ? (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      ) : (
                        <span className="mt-1.5 size-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {notification.body}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatRelativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </button>
                    {!selectMode ? (
                      <button
                        type="button"
                        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label="Xóa thông báo"
                        disabled={isMutating}
                        onClick={(event) => handleDeleteOne(event, notification.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="relative text-muted-foreground"
        aria-label="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </Button>
      {dropdown}
      <ConfirmDialog
        open={confirmDeleteAllOpen}
        onOpenChange={setConfirmDeleteAllOpen}
        title="Xóa tất cả thông báo?"
        description="Hành động này không thể hoàn tác. Tất cả thông báo sẽ bị xóa vĩnh viễn."
        confirmLabel="Xóa tất cả"
        variant="destructive"
        loading={deleteAll.isPending}
        onConfirm={handleDeleteAll}
      />
    </div>
  );
}
