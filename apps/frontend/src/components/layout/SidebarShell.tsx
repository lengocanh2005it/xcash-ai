import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/Logo';
import { SidebarCollapseFade } from '@/components/layout/SidebarCollapseFade';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarShellProps {
  collapsed?: boolean;
  showCollapseToggle?: boolean;
  onToggleCollapsed?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  headerRight?: ReactNode;
  navLabel?: string;
  navItems: ReactNode;
  footer: ReactNode;
}

export function SidebarShell({
  collapsed = false,
  showCollapseToggle,
  onToggleCollapsed,
  showClose,
  onClose,
  headerRight,
  navLabel,
  navItems,
  footer,
}: SidebarShellProps) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        className={cn(
          'border-b border-sidebar-border/80',
          collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'px-4 py-4',
        )}
      >
        <div
          className={cn(
            'flex w-full items-center',
            collapsed ? 'flex-col gap-2' : 'justify-between',
          )}
        >
          <div
            className={cn(
              'flex min-w-0 items-center gap-3 overflow-hidden',
              collapsed && 'justify-center',
            )}
          >
            <Logo collapsed={collapsed} markSize={collapsed ? 40 : 36} />
          </div>

          <div className={cn('flex shrink-0 items-center gap-1', collapsed ? 'flex-col' : '')}>
            {headerRight}
            {showCollapseToggle ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-5" />
                ) : (
                  <PanelLeftClose className="size-4" />
                )}
              </Button>
            ) : null}
            {showClose ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Đóng menu"
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className={cn(
          'scrollbar-hidden flex-1 overflow-y-auto px-3',
          collapsed ? 'space-y-2 py-2' : 'space-y-4 py-4',
        )}
      >
        <div className={cn(collapsed ? 'space-y-0.5' : 'space-y-1')}>
          {navLabel ? (
            <SidebarCollapseFade collapsed={collapsed} block className="px-3 pb-1">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {navLabel}
              </p>
            </SidebarCollapseFade>
          ) : null}
          {navItems}
        </div>
      </nav>

      <div className={cn('border-t border-sidebar-border/80 p-3', collapsed && 'px-2')}>
        {footer}
      </div>
    </div>
  );
}

interface DesktopSidebarWrapperProps {
  collapsed: boolean;
  children: ReactNode;
}

export function DesktopSidebarWrapper({ collapsed, children }: DesktopSidebarWrapperProps) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-[width] duration-200 ease-out lg:sticky lg:top-0 lg:flex lg:h-svh',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      {children}
    </aside>
  );
}

interface MobileSidebarWrapperProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function MobileSidebarWrapper({ open, onClose, children }: MobileSidebarWrapperProps) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(100vw-3rem,18rem)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl lg:hidden">
        {children}
      </aside>
    </>
  );
}
